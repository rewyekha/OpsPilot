"""
AzureMonitorTelemetryProvider — queries real Application Insights / Log Analytics
telemetry for the deployed demo workloads (album-api, voting-app).

Activated by TELEMETRY_MODE=azure. Uses the `azure-monitor-query` SDK with
`DefaultAzureCredential` (managed identity in Azure, az-login/env locally) to run
KQL against the workspace-based Application Insights tables.

The Azure SDK and a configured workspace id are required only when this provider
is *selected*. Imports are lazy so that, in synthetic mode, the app starts with
no Azure dependencies installed. When config or SDK is missing this raises
`TelemetryConfigurationError` with an actionable message rather than failing
silently.

NOTE: The KQL below targets the standard App Insights schema as projected into
Log Analytics (AppRequests / AppExceptions / AppDependencies). Time ranges and
thresholds are intentionally conservative; tune them in
`docs/PHASE8_IMPLEMENTATION_PLAN.md`.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from app.telemetry.base import TelemetryProvider
from app.telemetry.models import (
    DetectedIncident,
    HealthStatus,
    ServiceHealth,
    TelemetryConfigurationError,
    TelemetryMode,
)
from app.tools.logs_tools import LogEntry, LogQueryResult
from app.tools.metrics_tools import MetricSeries

log = logging.getLogger(__name__)

# Health classification thresholds (golden signals, 5-minute window).
_ERROR_RATE_DEGRADED = 1.0    # %  — elevated
_ERROR_RATE_UNHEALTHY = 10.0  # %  — failing
_LATENCY_DEGRADED_MS = 250.0
_LATENCY_UNHEALTHY_MS = 1000.0


class AzureMonitorTelemetryProvider(TelemetryProvider):
    """Live telemetry from Azure Monitor (App Insights + Log Analytics)."""

    name = "azure"
    mode = TelemetryMode.AZURE

    def __init__(self) -> None:
        from app.config import get_settings

        settings = get_settings()
        self._workspace_id = settings.azure_log_analytics_workspace_id
        if not self._workspace_id:
            raise TelemetryConfigurationError(
                "TELEMETRY_MODE=azure requires AZURE_LOG_ANALYTICS_WORKSPACE_ID "
                "(the workspace GUID / customerId). See infra/ARCHITECTURE.md."
            )
        self._client = self._build_client()
        log.info("telemetry.azure.initialized", extra={"workspace": self._workspace_id})

    # ── SDK plumbing ──────────────────────────────────────────────────────────

    def _build_client(self) -> Any:
        try:
            from azure.identity import DefaultAzureCredential
            from azure.monitor.query import LogsQueryClient
        except ImportError as exc:  # pragma: no cover - depends on optional deps
            raise TelemetryConfigurationError(
                "azure-monitor-query and azure-identity must be installed for "
                "TELEMETRY_MODE=azure. Run: pip install azure-monitor-query azure-identity"
            ) from exc
        return LogsQueryClient(DefaultAzureCredential())

    def _query(self, kql: str, window_minutes: int = 15) -> list[dict[str, Any]]:
        """Run a KQL query against the workspace, returning a list of row dicts."""
        from azure.monitor.query import LogsQueryStatus

        response = self._client.query_workspace(
            workspace_id=self._workspace_id,
            query=kql,
            timespan=timedelta(minutes=window_minutes),
        )
        if response.status != LogsQueryStatus.SUCCESS or not response.tables:
            log.warning("telemetry.azure.query_empty", extra={"status": str(response.status)})
            return []
        table = response.tables[0]
        cols = [c for c in table.columns]
        return [dict(zip(cols, row)) for row in table.rows]

    # ── Service inventory & health ────────────────────────────────────────────

    def list_services(self) -> list[str]:
        """Discover monitored workloads from Azure — NO hardcoded fallback.

        Unions two sources so discovery works whether or not the app has the
        Application Insights SDK installed:
          • AppRequests.AppRoleName        — instrumented apps (App Insights)
          • ContainerAppConsoleLogs_CL     — any Container App emitting stdout
        Returns [] when Azure has no monitored workloads (drives the dashboard's
        "No monitored Azure services discovered" empty state).
        """
        discovered: set[str] = set()

        # Source 1 — Application Insights role names (instrumented workloads).
        for r in self._query(
            "AppRequests | where TimeGenerated > ago(24h) "
            "| where isnotempty(AppRoleName) | distinct AppRoleName",
            window_minutes=60 * 24,
        ):
            name = r.get("AppRoleName")
            if name:
                discovered.add(str(name))

        # Source 2 — Container Apps console logs (works without any SDK).
        try:
            for r in self._query(
                "ContainerAppConsoleLogs_CL | where TimeGenerated > ago(24h) "
                "| where isnotempty(ContainerAppName_s) | distinct ContainerAppName_s",
                window_minutes=60 * 24,
            ):
                name = r.get("ContainerAppName_s")
                if name:
                    discovered.add(str(name))
        except Exception as exc:  # pragma: no cover - table may not exist yet
            log.warning("telemetry.azure.console_logs_unavailable", extra={"error": str(exc)})

        return sorted(discovered)

    def get_service_health(self, service: str) -> ServiceHealth:
        rows = self._query(
            f"""
            let svc = "{service}";
            let win = 5m;
            let reqs = AppRequests | where AppRoleName == svc and TimeGenerated > ago(win);
            let total = toscalar(reqs | count);
            let failures = toscalar(reqs | where Success == false | count);
            let p99 = toscalar(reqs | summarize percentile(DurationMs, 99));
            let last_exc = toscalar(
                AppExceptions | where AppRoleName == svc
                | summarize max(TimeGenerated)
            );
            print
                TotalRequests = total,
                Failures = failures,
                P99Ms = p99,
                LastException = last_exc
            """,
            window_minutes=5,
        )
        if not rows:
            return ServiceHealth(
                name=service, status=HealthStatus.UNKNOWN, responseTimeMs=0.0,
                errorRatePct=0.0, lastIncident=None, source="azure",
            )
        row = rows[0]
        total = float(row.get("TotalRequests") or 0)
        failures = float(row.get("Failures") or 0)
        p99 = float(row.get("P99Ms") or 0.0)
        error_rate = (failures / total * 100.0) if total else 0.0
        last_exc = row.get("LastException")
        last_incident = str(last_exc) if last_exc else None

        return ServiceHealth(
            name=service,
            status=self._classify(error_rate, p99),
            responseTimeMs=round(p99, 1),
            errorRatePct=round(error_rate, 2),
            lastIncident=last_incident,
            source="azure",
        )

    @staticmethod
    def _classify(error_rate_pct: float, p99_ms: float) -> HealthStatus:
        if error_rate_pct >= _ERROR_RATE_UNHEALTHY or p99_ms >= _LATENCY_UNHEALTHY_MS:
            return HealthStatus.UNHEALTHY
        if error_rate_pct >= _ERROR_RATE_DEGRADED or p99_ms >= _LATENCY_DEGRADED_MS:
            return HealthStatus.DEGRADED
        return HealthStatus.HEALTHY

    # ── Golden-signal metrics ─────────────────────────────────────────────────

    def query_error_rate(self, service: str) -> MetricSeries:
        rows = self._query(
            f"""
            AppRequests | where AppRoleName == "{service}"
            | summarize total = count(), failures = countif(Success == false)
                by bin(TimeGenerated, 1m)
            | extend value = iff(total == 0, 0.0, todouble(failures) / total * 100.0)
            | order by TimeGenerated asc
            | project timestamp = TimeGenerated, value
            """,
            window_minutes=30,
        )
        return self._to_series(service, "error_rate_pct", "percent", rows)

    def query_latency_p99(self, service: str) -> MetricSeries:
        rows = self._query(
            f"""
            AppRequests | where AppRoleName == "{service}"
            | summarize value = percentile(DurationMs, 99) by bin(TimeGenerated, 1m)
            | order by TimeGenerated asc
            | project timestamp = TimeGenerated, value
            """,
            window_minutes=30,
        )
        return self._to_series(service, "latency_p99_ms", "milliseconds", rows)

    def query_throughput(self, service: str) -> MetricSeries:
        rows = self._query(
            f"""
            AppRequests | where AppRoleName == "{service}"
            | summarize value = todouble(count()) / 60.0 by bin(TimeGenerated, 1m)
            | order by TimeGenerated asc
            | project timestamp = TimeGenerated, value
            """,
            window_minutes=30,
        )
        return self._to_series(service, "rps", "requests/sec", rows)

    @staticmethod
    def _to_series(service: str, metric: str, unit: str, rows: list[dict]) -> MetricSeries:
        datapoints = [
            {"timestamp": str(r.get("timestamp")), "value": float(r.get("value") or 0.0)}
            for r in rows
        ]
        values = [d["value"] for d in datapoints]
        peak = max(values) if values else 0.0
        baseline = (sum(values) / len(values)) if values else 0.0
        return MetricSeries(
            service=service, metric=metric, unit=unit, datapoints=datapoints,
            peak_value=peak, baseline_value=round(baseline, 2),
            anomaly_detected=bool(values and peak > baseline * 3),
        )

    # ── Logs ──────────────────────────────────────────────────────────────────

    def query_error_logs(self, service: str, window_minutes: int = 30) -> LogQueryResult:
        rows = self._query(
            f"""
            AppExceptions | where AppRoleName == "{service}"
            | summarize count = count(), first = min(TimeGenerated),
                        sample = any(OuterMessage), stack = any(Details)
                by type = ExceptionType
            | order by count desc
            """,
            window_minutes=window_minutes,
        )
        if not rows:
            return LogQueryResult(service=service, total_errors=0, error_types=[])
        total = int(sum(int(r.get("count") or 0) for r in rows))
        error_types = [
            {"type": r.get("type"), "count": int(r.get("count") or 0),
             "message": r.get("sample") or ""}
            for r in rows
        ]
        top = rows[0]
        sample = LogEntry(
            timestamp=str(top.get("first")),
            service=service,
            severity="ERROR",
            message=top.get("sample") or "",
            stack_trace=str(top.get("stack") or ""),
            count=int(top.get("count") or 0),
        )
        return LogQueryResult(
            service=service,
            total_errors=total,
            error_types=error_types,
            sample_entries=[sample],
            first_occurrence=str(top.get("first")),
            error_rate_per_minute=round(total / max(window_minutes, 1), 1),
        )

    # ── Incident generation ───────────────────────────────────────────────────

    def detect_incidents(self) -> list[DetectedIncident]:
        incidents: list[DetectedIncident] = []
        for service in self.list_services():
            health = self.get_service_health(service)
            if health.status is HealthStatus.UNHEALTHY:
                incidents.append(
                    DetectedIncident(
                        service=service,
                        title=f"{service}: error rate {health.error_rate_pct:.0f}% / p99 {health.response_time_ms:.0f}ms",
                        severity="P1",
                        detectedAt=health.last_incident or "",
                        signal="error_rate_pct" if health.error_rate_pct >= _ERROR_RATE_UNHEALTHY else "latency_p99_ms",
                        summary=(
                            f"{service} breached health thresholds "
                            f"(error rate {health.error_rate_pct:.1f}%, p99 {health.response_time_ms:.0f}ms)."
                        ),
                    )
                )
        return incidents

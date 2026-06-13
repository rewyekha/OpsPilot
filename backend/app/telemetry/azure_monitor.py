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
from datetime import datetime, timedelta, timezone
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

# A workload is "monitored" only if it emitted telemetry within
# Settings.discovery_window_minutes. Log Analytics retains historical rows for the
# workspace retention period, so a deleted Container App keeps appearing over a
# wide window — scoping discovery to recent activity drops a deleted workload, but
# a wider window keeps an idle-but-live demo app visible (see config).


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
        """Run a KQL query against the workspace, returning a list of row dicts.

        Resilient by design: any failure (KQL syntax error, transient service
        error, a not-yet-created table) is logged and returns [] — so one bad
        query degrades gracefully to "no data" and never propagates an exception
        that would crash an agent into its mock fallback.
        """
        from azure.monitor.query import LogsQueryStatus

        try:
            response = self._client.query_workspace(
                workspace_id=self._workspace_id,
                query=kql,
                timespan=timedelta(minutes=window_minutes),
            )
        except Exception as exc:  # noqa: BLE001 - never let telemetry crash an agent
            msg = str(exc)
            # A semantic error (SEM0xxx) means a referenced table/column doesn't
            # exist yet — expected for optional tables (e.g. ContainerAppConsoleLogs_CL
            # before any Container App has logged). Degrade silently; don't warn.
            if "SemanticError" in msg or "SEM0" in msg or "Failed to resolve" in msg:
                log.debug("telemetry.azure.table_absent", extra={"error": msg})
            else:
                log.warning("telemetry.azure.query_failed", extra={"error": msg})
            return []

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
        from app.config import get_settings

        discovered: set[str] = set()
        win = get_settings().discovery_window_minutes

        # Source 1 — Application Insights role names (instrumented workloads).
        # Scoped to recent activity so a deleted workload (whose historical rows
        # linger in Log Analytics for the retention period) ages out promptly.
        for r in self._query(
            f"AppRequests | where TimeGenerated > ago({win}m) "
            "| where isnotempty(AppRoleName) | distinct AppRoleName",
            window_minutes=win,
        ):
            name = r.get("AppRoleName")
            if name:
                discovered.add(str(name))

        # Source 2 — Container Apps console logs (works without any SDK).
        # _query is resilient (returns [] if the table doesn't exist yet), so no
        # try/except is needed and no console_logs_unavailable warning is emitted.
        for r in self._query(
            f"ContainerAppConsoleLogs_CL | where TimeGenerated > ago({win}m) "
            "| where isnotempty(ContainerAppName_s) | distinct ContainerAppName_s",
            window_minutes=win,
        ):
            name = r.get("ContainerAppName_s")
            if name:
                discovered.add(str(name))

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
        last_exc = row.get("LastException")
        last_incident = str(last_exc) if last_exc else None

        # No requests in the health window → the workload is not currently serving
        # (idle or just deleted). Report UNKNOWN, never a fabricated "healthy 0/0".
        # The `print` query always returns one row, so this — not the `if not rows`
        # branch above — is what guards a no-telemetry service.
        if total <= 0:
            return ServiceHealth(
                name=service, status=HealthStatus.UNKNOWN, responseTimeMs=0.0,
                errorRatePct=0.0, lastIncident=last_incident, source="azure",
            )

        error_rate = failures / total * 100.0
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
        # NOTE: `first` is a RESERVED KQL keyword — using it as a summarize output
        # column name fails to parse (SYN0002: "could not be parsed at 'first'").
        # Aliases below are all non-reserved; `take_any()` replaces the deprecated
        # `any()`. Validated against Azure Monitor KQL.
        rows = self._query(
            f"""
            AppExceptions | where AppRoleName == "{service}"
            | summarize errorCount = count(), firstSeen = min(TimeGenerated),
                        sample = take_any(OuterMessage), stack = take_any(Details)
                by exceptionType = ExceptionType
            | order by errorCount desc
            """,
            window_minutes=window_minutes,
        )
        if not rows:
            return LogQueryResult(service=service, total_errors=0, error_types=[])
        total = int(sum(int(r.get("errorCount") or 0) for r in rows))
        error_types = [
            {"type": r.get("exceptionType"), "count": int(r.get("errorCount") or 0),
             "message": r.get("sample") or ""}
            for r in rows
        ]
        top = rows[0]
        sample = LogEntry(
            timestamp=str(top.get("firstSeen")),
            service=service,
            severity="ERROR",
            message=top.get("sample") or "",
            stack_trace=str(top.get("stack") or ""),
            count=int(top.get("errorCount") or 0),
        )
        return LogQueryResult(
            service=service,
            total_errors=total,
            error_types=error_types,
            sample_entries=[sample],
            first_occurrence=str(top.get("firstSeen")),
            error_rate_per_minute=round(total / max(window_minutes, 1), 1),
        )

    # ── Incident generation (autonomous detection) ────────────────────────────

    def detect_incidents(self) -> list[DetectedIncident]:
        """Scan telemetry and surface incidents that breach configured thresholds.

        Telemetry-driven ONLY. Each candidate is derived from real Application
        Insights / Log Analytics signals. Returns [] when nothing breaches — it
        never fabricates an incident. Evaluated per service:

          • restart storm        (>= N container restarts / 15m)        → P1
          • service down         (active in 15m, ZERO requests in 5m)    → P1
          • critical error rate  (> crit% failing requests / 5m)        → P1
          • elevated error rate  (> warn% failing requests / 5m)        → P2
          • high latency         (p95 > threshold ms / 5m)              → P2

        Deployment regressions surface here as the error-rate spike they cause.
        """
        from app.config import get_settings

        cfg = get_settings()
        incidents: list[DetectedIncident] = []
        for service in self.list_services():
            det = self._detect_for_service(service, cfg)
            if det is not None:
                incidents.append(det)
        return incidents

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _detect_for_service(self, service: str, cfg: Any) -> DetectedIncident | None:
        rows = self._query(
            f"""
            let svc = "{service}";
            let recent = AppRequests | where AppRoleName == svc and TimeGenerated > ago(5m);
            let prior = AppRequests | where AppRoleName == svc and TimeGenerated > ago(15m);
            print
                total5 = toscalar(recent | count),
                fail5 = toscalar(recent | where Success == false | count),
                p95 = toscalar(recent | summarize percentile(DurationMs, 95)),
                total15 = toscalar(prior | count),
                lastSeen = toscalar(prior | summarize max(TimeGenerated))
            """,
            window_minutes=15,
        )
        if not rows:
            return None
        r = rows[0]
        total5 = float(r.get("total5") or 0)
        fail5 = float(r.get("fail5") or 0)
        p95 = float(r.get("p95") or 0.0)
        total15 = float(r.get("total15") or 0)
        last_seen = str(r.get("lastSeen") or "") or None
        now = self._now_iso()

        # 1) Container restart storm (best-effort; ContainerAppSystemLogs_CL may be absent).
        restarts = self._restart_count(service)
        if restarts >= cfg.detect_restart_storm_count:
            return DetectedIncident(
                service=service,
                title=f"{service}: container restart storm ({restarts} restarts/15m)",
                severity="P1", detectedAt=now, signal="restart_storm",
                summary=(f"{service} restarted {restarts} times in the last 15 minutes "
                         f"(>= {cfg.detect_restart_storm_count}) — container instability."),
            )

        # 2) Service down — was serving traffic, now zero requests.
        if total5 == 0 and total15 > 0:
            return DetectedIncident(
                service=service,
                title=f"{service}: service down (0 requests in 5m)",
                severity="P1", detectedAt=last_seen or now, signal="service_down",
                summary=(f"{service} served {int(total15)} requests in the prior 15m window but "
                         f"ZERO in the last 5m — unreachable / scaled to zero / crashed."),
            )
        if total5 == 0:
            return None  # idle / not currently serving → UNKNOWN, never fabricate

        error_rate = fail5 / total5 * 100.0

        # 3) Critical error rate.
        if error_rate > cfg.detect_error_rate_crit_pct:
            return DetectedIncident(
                service=service,
                title=f"{service}: error rate {error_rate:.0f}% (critical)",
                severity="P1", detectedAt=now, signal="error_rate_critical",
                summary=(f"{service} error rate is {error_rate:.1f}% over the last 5m "
                         f"({int(fail5)}/{int(total5)} requests failing) — above the "
                         f"{cfg.detect_error_rate_crit_pct:.0f}% critical threshold."),
            )

        # 4) Elevated error rate.
        if error_rate > cfg.detect_error_rate_warn_pct:
            return DetectedIncident(
                service=service,
                title=f"{service}: error rate {error_rate:.0f}%",
                severity="P2", detectedAt=now, signal="error_rate_elevated",
                summary=(f"{service} error rate is {error_rate:.1f}% over the last 5m "
                         f"({int(fail5)}/{int(total5)} failing) — above the "
                         f"{cfg.detect_error_rate_warn_pct:.0f}% threshold."),
            )

        # 5) High latency (p95).
        if p95 > cfg.detect_latency_p95_ms:
            return DetectedIncident(
                service=service,
                title=f"{service}: p95 latency {p95:.0f}ms",
                severity="P2", detectedAt=now, signal="latency_p95",
                summary=(f"{service} p95 response time is {p95:.0f}ms over the last 5m — "
                         f"above the {cfg.detect_latency_p95_ms:.0f}ms threshold."),
            )

        return None

    def _restart_count(self, service: str) -> int:
        """Container restarts in the last 15m from Container Apps system logs.
        Returns 0 if the table is absent (best-effort; never fabricates)."""
        rows = self._query(
            f"""
            ContainerAppSystemLogs_CL
            | where ContainerAppName_s == "{service}" and TimeGenerated > ago(15m)
            | where Reason_s in ("Killing", "BackOff", "Unhealthy", "Restarting")
                 or Log_s has "restart"
            | count
            """,
            window_minutes=15,
        )
        if not rows:
            return 0
        try:
            return int(rows[0].get("Count") or rows[0].get("count_") or 0)
        except (TypeError, ValueError):
            return 0

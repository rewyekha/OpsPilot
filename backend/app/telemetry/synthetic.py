"""
SyntheticTelemetryProvider — the deterministic, zero-credential telemetry backend.

Phase 9: this provider NO LONGER ships a hardcoded service inventory. Service
discovery is an Azure-only concern (see AzureMonitorTelemetryProvider), so in
synthetic mode `list_services()` returns an empty roster and the dashboard shows
the "No monitored Azure services discovered" empty state.

What remains here are the deterministic *metric/log fixtures* (delegating to
`app.tools.metrics_tools` / `app.tools.logs_tools`). Those are keyed by a service
name passed in by a caller (e.g. an agent investigating a specific incident) and
are NOT a service inventory — they exist so unit tests and offline agent runs
have stable data shapes. The provider itself is never removed (it is the
zero-credential default for the abstraction).
"""
from __future__ import annotations

from app.telemetry.base import TelemetryProvider
from app.telemetry.models import (
    DetectedIncident,
    HealthStatus,
    ServiceHealth,
    TelemetryMode,
)
from app.tools.logs_tools import LogQueryResult, query_error_logs
from app.tools.metrics_tools import (
    MetricSeries,
    query_error_rate,
    query_latency_p99,
    query_throughput,
)


class SyntheticTelemetryProvider(TelemetryProvider):
    """Fixture-backed telemetry. Deterministic and offline.

    Carries NO service inventory — discovery is Azure-only.
    """

    name = "synthetic"
    mode = TelemetryMode.SYNTHETIC

    # ── Service inventory & health (intentionally empty — no hardcoded roster) ─

    def list_services(self) -> list[str]:
        """No synthetic inventory: services are discovered from Azure only."""
        return []

    def get_service_health(self, service: str) -> ServiceHealth:
        return ServiceHealth(
            name=service,
            status=HealthStatus.UNKNOWN,
            responseTimeMs=0.0,
            errorRatePct=0.0,
            lastIncident=None,
            source="synthetic",
        )

    def get_all_service_health(self) -> list[ServiceHealth]:
        """Empty roster — nothing is discovered in synthetic mode."""
        return []

    # ── Golden-signal metrics (delegate to deterministic fixtures) ────────────

    def query_error_rate(self, service: str) -> MetricSeries:
        return query_error_rate(service)

    def query_latency_p99(self, service: str) -> MetricSeries:
        return query_latency_p99(service)

    def query_throughput(self, service: str) -> MetricSeries:
        return query_throughput(service)

    # ── Logs ──────────────────────────────────────────────────────────────────

    def query_error_logs(self, service: str, window_minutes: int = 30) -> LogQueryResult:
        return query_error_logs(service, window_minutes)

    # ── Incident generation ───────────────────────────────────────────────────

    def detect_incidents(self) -> list[DetectedIncident]:
        """No synthetic inventory to scan — incidents come from real telemetry."""
        return []

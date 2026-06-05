"""
TelemetryProvider — the single interface every monitoring backend implements.

Mirrors the design of `app.providers.AIProvider`: agents, endpoints, and the
dashboard depend only on this interface; the concrete provider
(Synthetic or AzureMonitor) is chosen centrally by the factory based on the
TELEMETRY_MODE feature flag. This is the seam that lets OpsPilot switch between
synthetic fixtures and real Azure Monitor telemetry without any caller change.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.telemetry.models import DetectedIncident, ServiceHealth, TelemetryMode
from app.tools.logs_tools import LogQueryResult
from app.tools.metrics_tools import MetricSeries


class TelemetryProvider(ABC):
    """Common contract for all telemetry (monitoring) providers."""

    #: Stable identifier surfaced in API responses ("synthetic" | "azure").
    name: str = "base"
    #: The telemetry mode this provider represents.
    mode: TelemetryMode = TelemetryMode.SYNTHETIC

    @property
    def is_live(self) -> bool:
        """True when this provider queries real Azure telemetry (i.e. not synthetic)."""
        return self.mode is TelemetryMode.AZURE

    # ── Service inventory & health (powers the 'Monitored Services' panel) ────

    @abstractmethod
    def list_services(self) -> list[str]:
        """Return the names of the services OpsPilot is monitoring."""
        ...

    @abstractmethod
    def get_service_health(self, service: str) -> ServiceHealth:
        """Return current health (status, response time, last incident) for *service*."""
        ...

    def get_all_service_health(self) -> list[ServiceHealth]:
        """Return health for every monitored service (default: map over list_services)."""
        return [self.get_service_health(s) for s in self.list_services()]

    # ── Golden-signal metrics (consumed by the Metrics agent) ─────────────────

    @abstractmethod
    def query_error_rate(self, service: str) -> MetricSeries:
        """Error-rate time series (percent) for *service*."""
        ...

    @abstractmethod
    def query_latency_p99(self, service: str) -> MetricSeries:
        """p99 latency time series (milliseconds) for *service*."""
        ...

    @abstractmethod
    def query_throughput(self, service: str) -> MetricSeries:
        """Requests-per-second time series for *service*."""
        ...

    # ── Logs (consumed by the Logs agent) ─────────────────────────────────────

    @abstractmethod
    def query_error_logs(self, service: str, window_minutes: int = 30) -> LogQueryResult:
        """Error-log summary for *service* over the last *window_minutes*."""
        ...

    # ── Incident generation ───────────────────────────────────────────────────

    @abstractmethod
    def detect_incidents(self) -> list[DetectedIncident]:
        """Scan current telemetry and return any incidents worth investigating."""
        ...

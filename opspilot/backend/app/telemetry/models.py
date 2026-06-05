"""
Shared enums and value objects for the telemetry provider layer.

Dependency-free (no Azure imports) so they can be imported anywhere — including
at startup with zero credentials, mirroring `app.providers.models`.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class TelemetryMode(str, Enum):
    """Where OpsPilot sources monitoring data from.

    Selected by the TELEMETRY_MODE feature flag. SYNTHETIC is the zero-credential
    default and is never removed; AZURE queries real Application Insights / Log
    Analytics for the deployed demo workloads.
    """

    SYNTHETIC = "synthetic"  # deterministic fixtures (local dev, CI, offline demo)
    AZURE = "azure"          # Azure Monitor (App Insights + Log Analytics) via KQL

    @classmethod
    def parse(cls, value: str) -> "TelemetryMode":
        """Parse a raw env string, defaulting to SYNTHETIC on anything unrecognised."""
        try:
            return cls(value.strip().lower())
        except (ValueError, AttributeError):
            return cls.SYNTHETIC


class HealthStatus(str, Enum):
    """Coarse service health, derived from golden-signal telemetry."""

    HEALTHY = "healthy"      # error rate + latency within baseline
    DEGRADED = "degraded"    # elevated errors or latency, not yet failing
    UNHEALTHY = "unhealthy"  # active failure (error spike / dependency down)
    UNKNOWN = "unknown"      # no telemetry available


class ServiceHealth(BaseModel):
    """One row in the dashboard's 'Monitored Services' panel."""

    name: str = Field(description="Service / Container App name")
    status: HealthStatus = Field(description="Coarse health classification")
    response_time_ms: float = Field(
        alias="responseTimeMs",
        description="Representative response time (p99 latency, milliseconds)",
    )
    error_rate_pct: float = Field(
        default=0.0,
        alias="errorRatePct",
        description="Current error rate as a percentage",
    )
    last_incident: str | None = Field(
        default=None,
        alias="lastIncident",
        description="ISO-8601 timestamp of the most recent incident, or null if none",
    )
    source: str = Field(
        description="Telemetry source that produced this row ('synthetic' | 'azure')",
    )

    model_config = {"populate_by_name": True}


class DetectedIncident(BaseModel):
    """A candidate incident surfaced by scanning telemetry (incident generation)."""

    service: str
    title: str
    severity: str = Field(description="P1 | P2 | P3")
    detected_at: str = Field(alias="detectedAt", description="ISO-8601 onset timestamp")
    signal: str = Field(description="The metric/log signal that tripped the threshold")
    summary: str

    model_config = {"populate_by_name": True}


class TelemetryConfigurationError(RuntimeError):
    """Raised when the Azure telemetry provider is requested but its required
    configuration (workspace id / credentials / SDK) is absent.
    """

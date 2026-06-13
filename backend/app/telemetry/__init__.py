"""Telemetry provider layer.

Abstracts where OpsPilot sources monitoring data from, selected by the
TELEMETRY_MODE feature flag (synthetic | azure). See base.TelemetryProvider.
"""
from app.telemetry.base import TelemetryProvider
from app.telemetry.factory import (
    get_telemetry_provider,
    reset_telemetry_cache,
    resolve_telemetry_mode,
    telemetry_is_live,
)
from app.telemetry.models import (
    DetectedIncident,
    HealthStatus,
    ServiceHealth,
    TelemetryConfigurationError,
    TelemetryMode,
)
from app.telemetry.synthetic import SyntheticTelemetryProvider

__all__ = [
    "TelemetryProvider",
    "SyntheticTelemetryProvider",
    "get_telemetry_provider",
    "reset_telemetry_cache",
    "resolve_telemetry_mode",
    "telemetry_is_live",
    "TelemetryMode",
    "HealthStatus",
    "ServiceHealth",
    "DetectedIncident",
    "TelemetryConfigurationError",
]

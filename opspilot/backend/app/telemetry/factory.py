"""
Telemetry provider factory — the single, centralized place that decides which
TelemetryProvider the application uses, driven by the TELEMETRY_MODE feature flag.

Resolution rules (mirrors app.providers.factory):
  - synthetic → SyntheticTelemetryProvider (always; zero-credential default)
  - azure     → AzureMonitorTelemetryProvider
                (raises TelemetryConfigurationError if workspace/SDK missing)

The synthetic provider is never removed — it remains the default and the safe
fallback for local dev, CI, and the offline demo.
"""
from __future__ import annotations

import logging
from functools import lru_cache

from app.config import get_settings
from app.telemetry.base import TelemetryProvider
from app.telemetry.models import TelemetryMode
from app.telemetry.synthetic import SyntheticTelemetryProvider

log = logging.getLogger(__name__)


def resolve_telemetry_mode() -> TelemetryMode:
    """Resolve the effective telemetry mode from settings."""
    return TelemetryMode.parse(get_settings().telemetry_mode)


def telemetry_is_live() -> bool:
    """True when the resolved mode queries real Azure telemetry."""
    return resolve_telemetry_mode() is TelemetryMode.AZURE


@lru_cache
def get_telemetry_provider() -> TelemetryProvider:
    """Return the process-wide telemetry provider singleton for the current mode.

    Cached; call get_telemetry_provider.cache_clear() after changing settings.
    """
    mode = resolve_telemetry_mode()
    if mode is TelemetryMode.AZURE:
        # Imported lazily so synthetic mode never needs the Azure SDK installed.
        from app.telemetry.azure_monitor import AzureMonitorTelemetryProvider

        provider: TelemetryProvider = AzureMonitorTelemetryProvider()
        log.info("telemetry.selected", extra={"provider": provider.name, "mode": mode.value})
        return provider

    provider = SyntheticTelemetryProvider()
    log.info("telemetry.selected", extra={"provider": provider.name, "mode": mode.value})
    return provider


def reset_telemetry_cache() -> None:
    """Clear the cached telemetry provider (used by tests / after config changes)."""
    get_telemetry_provider.cache_clear()

"""
Provider factory — the single, centralized place that decides which AIProvider
the application uses. No agent or endpoint constructs a provider directly.

Resolution rules (driven by EXECUTION_MODE, never by `bool(endpoint)`):
  - mock     → MockProvider (always)
  - foundry  → FoundryProvider (raises ProviderConfigurationError if creds missing)
  - auto     → FoundryProvider when FOUNDRY_ENDPOINT is set, otherwise MockProvider
"""
from __future__ import annotations

import logging
from functools import lru_cache

from app.config import get_settings
from app.providers.base import AIProvider
from app.providers.foundry import FoundryProvider
from app.providers.mock import MockProvider
from app.providers.models import ExecutionMode

log = logging.getLogger(__name__)


def foundry_credentials_present() -> bool:
    """True when enough config exists to attempt a Foundry connection."""
    return bool(get_settings().foundry_endpoint)


def resolve_execution_mode() -> ExecutionMode:
    """Resolve the *effective* mode (collapses AUTO to MOCK or FOUNDRY)."""
    mode = ExecutionMode.parse(get_settings().execution_mode)
    if mode is ExecutionMode.AUTO:
        return ExecutionMode.FOUNDRY if foundry_credentials_present() else ExecutionMode.MOCK
    return mode


def provider_is_live() -> bool:
    """True when the resolved mode is Foundry (real model calls)."""
    return resolve_execution_mode() is ExecutionMode.FOUNDRY


@lru_cache
def get_provider() -> AIProvider:
    """Return the process-wide provider singleton for the current mode.

    Cached; call get_provider.cache_clear() after changing settings (e.g. tests).
    """
    mode = resolve_execution_mode()
    if mode is ExecutionMode.FOUNDRY:
        provider: AIProvider = FoundryProvider()
        log.info("provider.selected", extra={"provider": provider.name, "mode": mode.value})
        return provider

    provider = MockProvider()
    log.info("provider.selected", extra={"provider": provider.name, "mode": mode.value})
    return provider


def reset_provider_cache() -> None:
    """Clear the cached provider (used by tests / after config changes)."""
    get_provider.cache_clear()

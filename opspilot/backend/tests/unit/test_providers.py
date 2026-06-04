"""Unit tests for the AI provider layer (Foundry Integration Phase 1).

Covers execution-mode resolution, role→deployment routing (incl. the o3
reasoning role), the mock provider, and the foundry-without-credentials guard.
No Azure SDK or network access is required.
"""
from __future__ import annotations

import pytest

from app.config import get_settings
from app.providers import (
    ExecutionMode,
    ModelRole,
    MockProvider,
    ProviderConfigurationError,
    get_provider,
    provider_is_live,
    reset_provider_cache,
    resolve_execution_mode,
)


@pytest.fixture(autouse=True)
def _reset_caches():
    """Ensure settings + provider caches don't leak between mode-switching tests."""
    get_settings.cache_clear()
    reset_provider_cache()
    yield
    get_settings.cache_clear()
    reset_provider_cache()


def test_default_mode_is_mock(monkeypatch):
    monkeypatch.delenv("EXECUTION_MODE", raising=False)
    monkeypatch.delenv("FOUNDRY_ENDPOINT", raising=False)
    get_settings.cache_clear()
    reset_provider_cache()
    assert resolve_execution_mode() is ExecutionMode.MOCK
    assert get_provider().name == "mock"
    assert provider_is_live() is False


def test_mock_provider_routes_reasoning_to_o3():
    provider = MockProvider()
    assert provider.model_for(ModelRole.COMMANDER) == "gpt-4o"
    assert provider.model_for(ModelRole.SPECIALIST) == "gpt-4o-mini"
    assert provider.model_for(ModelRole.REASONING) == "o3"


@pytest.mark.asyncio
async def test_mock_generate_is_deterministic_and_role_aware():
    provider = MockProvider()
    out = await provider.generate(ModelRole.REASONING, "why did it fail?")
    assert "o3" in out and "reasoning" in out
    # deterministic: same input → same output
    assert out == await provider.generate(ModelRole.REASONING, "why did it fail?")


def test_auto_without_endpoint_falls_back_to_mock(monkeypatch):
    monkeypatch.setenv("EXECUTION_MODE", "auto")
    monkeypatch.delenv("FOUNDRY_ENDPOINT", raising=False)
    get_settings.cache_clear()
    reset_provider_cache()
    assert resolve_execution_mode() is ExecutionMode.MOCK
    assert get_provider().name == "mock"


def test_auto_with_endpoint_selects_foundry(monkeypatch):
    monkeypatch.setenv("EXECUTION_MODE", "auto")
    monkeypatch.setenv("FOUNDRY_ENDPOINT", "https://demo.openai.azure.com/")
    monkeypatch.setenv("FOUNDRY_API_KEY", "fake-key")
    get_settings.cache_clear()
    reset_provider_cache()
    assert resolve_execution_mode() is ExecutionMode.FOUNDRY
    provider = get_provider()
    assert provider.name == "foundry"
    assert provider.is_live is True
    assert provider.model_for(ModelRole.REASONING) == "o3"


def test_foundry_without_credentials_raises(monkeypatch):
    monkeypatch.setenv("EXECUTION_MODE", "foundry")
    monkeypatch.delenv("FOUNDRY_ENDPOINT", raising=False)
    get_settings.cache_clear()
    reset_provider_cache()
    assert resolve_execution_mode() is ExecutionMode.FOUNDRY
    with pytest.raises(ProviderConfigurationError):
        get_provider()


def test_unrecognised_mode_defaults_to_mock(monkeypatch):
    monkeypatch.setenv("EXECUTION_MODE", "banana")
    get_settings.cache_clear()
    reset_provider_cache()
    assert resolve_execution_mode() is ExecutionMode.MOCK

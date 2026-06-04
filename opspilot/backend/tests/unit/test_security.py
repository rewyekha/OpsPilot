"""Phase 5 — API-key protection tests for the model-invoking endpoints.

Verifies opt-in behavior: open when DEV_API_KEY is unset, 401 on missing/invalid
header when set, and 200 with the correct header (mock mode).
"""
from __future__ import annotations

import httpx
import pytest

from app.config import get_settings
from app.providers.factory import reset_provider_cache


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    monkeypatch.delenv("EXECUTION_MODE", raising=False)  # mock
    monkeypatch.delenv("DEV_API_KEY", raising=False)
    get_settings.cache_clear()
    reset_provider_cache()
    yield
    get_settings.cache_clear()
    reset_provider_cache()


def _client() -> httpx.AsyncClient:
    from app.main import app

    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_open_when_no_key_configured():
    async with _client() as c:
        r = await c.post("/api/test/foundry", json={"message": "ping"})
    assert r.status_code == 200
    assert r.json()["provider"] == "mock"


@pytest.mark.asyncio
async def test_401_when_key_required_but_missing(monkeypatch):
    monkeypatch.setenv("DEV_API_KEY", "s3cret")
    get_settings.cache_clear()
    async with _client() as c:
        r = await c.post("/api/test/foundry", json={"message": "ping"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_401_when_key_invalid(monkeypatch):
    monkeypatch.setenv("DEV_API_KEY", "s3cret")
    get_settings.cache_clear()
    async with _client() as c:
        r = await c.post(
            "/api/test/foundry",
            json={"message": "ping"},
            headers={"X-API-KEY": "wrong"},
        )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_200_when_key_valid(monkeypatch):
    monkeypatch.setenv("DEV_API_KEY", "s3cret")
    get_settings.cache_clear()
    async with _client() as c:
        r = await c.post(
            "/api/test/foundry",
            json={"message": "ping"},
            headers={"X-API-KEY": "s3cret"},
        )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_agents_test_endpoint_also_protected(monkeypatch):
    monkeypatch.setenv("DEV_API_KEY", "s3cret")
    get_settings.cache_clear()
    async with _client() as c:
        unauth = await c.post("/api/agents/test", json={"incident": "checkout is failing now"})
        auth = await c.post(
            "/api/agents/test",
            json={"incident": "checkout is failing now"},
            headers={"X-API-KEY": "s3cret"},
        )
    assert unauth.status_code == 401
    assert auth.status_code == 200

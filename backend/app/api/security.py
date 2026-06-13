"""
Lightweight API-key protection for model-invoking endpoints (Phase 5).

Opt-in by design: if `DEV_API_KEY` is unset (the local-dev default), the
dependency is a no-op and existing behavior is preserved. When set, protected
endpoints require a matching `X-API-KEY` header and return 401 otherwise.

This is intentionally simple (a shared dev key) — it exists to prevent
unauthenticated, billable model calls during a public demo, not to be a full
auth system.
"""
from __future__ import annotations

from fastapi import Header, HTTPException, status

from app.config import get_settings

API_KEY_HEADER = "X-API-KEY"


async def require_api_key(x_api_key: str | None = Header(default=None, alias=API_KEY_HEADER)) -> None:
    """FastAPI dependency: enforce X-API-KEY only when DEV_API_KEY is configured."""
    configured = get_settings().dev_api_key
    if not configured:
        return  # open in local dev — behavior unchanged
    if x_api_key != configured:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-KEY.",
            headers={"WWW-Authenticate": API_KEY_HEADER},
        )

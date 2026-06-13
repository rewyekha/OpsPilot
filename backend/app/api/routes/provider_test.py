"""Provider smoke-test endpoint.

POST /api/test/foundry — exercises the AI provider layer in isolation, before
any agent/orchestration wiring. Returns which provider answered, the deployment
that backed the role, and the generated text. Works in both mock and Foundry
modes.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.security import require_api_key
from app.providers.factory import get_provider, reset_provider_cache
from app.providers.models import ModelRole, ProviderConfigurationError

log = logging.getLogger(__name__)

router = APIRouter(prefix="/test", tags=["test"])


class FoundryTestRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="Prompt to send through the provider.",
        examples=["Analyze checkout-service outage"],
    )
    role: str = Field(
        default="commander",
        description="Model role to route to: commander | specialist | reasoning.",
    )


class FoundryTestResponse(BaseModel):
    provider: str = Field(description="'mock' or 'foundry'")
    model: str = Field(description="Deployment name that backed the role")
    role: str
    response: str


@router.post(
    "/foundry",
    response_model=FoundryTestResponse,
    summary="Smoke-test the AI provider layer",
    description=(
        "Routes the supplied message through the active provider (selected by "
        "EXECUTION_MODE) using the requested model role. Use this to verify the "
        "provider layer independently of the agents."
    ),
    responses={
        401: {"description": "Invalid or missing X-API-KEY (when DEV_API_KEY is set)"},
        503: {"description": "Foundry mode selected but not configured"},
    },
    dependencies=[Depends(require_api_key)],
)
async def test_foundry(body: FoundryTestRequest) -> FoundryTestResponse:
    # Re-resolve each call so the endpoint reflects the current EXECUTION_MODE
    # (handy during local configuration without a server restart).
    reset_provider_cache()

    role = ModelRole.parse(body.role)

    try:
        provider = get_provider()
        model = provider.model_for(role)
        text = await provider.generate(role, body.message)
    except ProviderConfigurationError as exc:
        log.warning("provider.test.misconfigured", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # live call failed (network/auth/model)
        log.exception("provider.test.failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Provider call failed: {exc}",
        ) from exc

    return FoundryTestResponse(
        provider=provider.name,
        model=model,
        role=role.value,
        response=text,
    )

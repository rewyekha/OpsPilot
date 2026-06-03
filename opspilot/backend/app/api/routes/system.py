"""System health and agent test endpoints.

Endpoints:
  GET  /api/system/health        — Foundry configuration status + available agents
  POST /api/agents/test          — Run MetricsAgent, LogsAgent, DeploymentAgent against a
                                   user-supplied incident description and return findings
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.agents.deployment.agent import DeploymentAgent
from app.agents.logs.agent import LogsAgent
from app.agents.metrics.agent import MetricsAgent
from app.agents.state import OpsPilotState, Severity
from app.config import get_settings
from app.services.event_stream import get_event_stream
from app.services.foundry import get_foundry_client

log = structlog.get_logger(__name__)

router = APIRouter(tags=["system"])

# ─── Response models ─────────────────────────────────────────────────────────


class FoundryHealthResponse(BaseModel):
    foundry_configured: bool = Field(alias="foundryConfigured")
    specialist_model: str = Field(alias="specialistModel")
    commander_model: str = Field(alias="commanderModel")
    reasoning_model: str = Field(alias="reasoningModel")
    agents_available: list[str] = Field(alias="agentsAvailable")
    execution_mode: str = Field(
        alias="executionMode",
        description="'live' when Azure OpenAI is configured, 'mock' otherwise",
    )
    azure_openai_endpoint: str = Field(
        alias="azureOpenAiEndpoint",
        description="Endpoint URL (masked) or empty string if not set",
    )

    model_config = {"populate_by_name": True}


class AgentTestRequest(BaseModel):
    incident: str = Field(
        ...,
        min_length=10,
        description="Plain-text incident description to investigate",
        examples=["Checkout service failing after deployment"],
    )


class AgentRunResult(BaseModel):
    agent: str
    role_label: str = Field(alias="roleLabel")
    mode: str = Field(description="'live' or 'mock'")
    confidence: float
    summary: str
    evidence: list[str]
    duration_ms: float = Field(alias="durationMs")
    metadata: dict[str, Any]

    model_config = {"populate_by_name": True}


class AgentTestResponse(BaseModel):
    incident: str
    timestamp: str
    foundry_configured: bool = Field(alias="foundryConfigured")
    results: list[AgentRunResult]
    total_duration_ms: float = Field(alias="totalDurationMs")

    model_config = {"populate_by_name": True}


# ─── Helpers ─────────────────────────────────────────────────────────────────

_AGENT_REGISTRY = [
    "metrics",
    "logs",
    "deployment",
    "time_machine",
    "root_cause",
    "recommendation",
    "commander",
]


def _mask_endpoint(endpoint: str) -> str:
    """Return the hostname only, hiding path/key material."""
    if not endpoint:
        return ""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(endpoint)
        return f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return endpoint[:40] + "..." if len(endpoint) > 40 else endpoint


# ─── GET /api/system/health ───────────────────────────────────────────────────

@router.get(
    "/system/health",
    response_model=FoundryHealthResponse,
    summary="Azure AI Foundry configuration health",
    description=(
        "Returns current Foundry configuration status, model deployment names, "
        "and the list of available investigation agents. "
        "executionMode is 'live' when AZURE_OPENAI_ENDPOINT is set, 'mock' otherwise."
    ),
)
async def system_health() -> FoundryHealthResponse:
    settings = get_settings()
    foundry = get_foundry_client()

    log.info(
        "system.health.checked",
        foundry_configured=foundry.is_configured,
        execution_mode="live" if foundry.is_configured else "mock",
    )

    return FoundryHealthResponse(
        foundryConfigured=foundry.is_configured,
        specialistModel=settings.specialist_model_deployment,
        commanderModel=settings.commander_model_deployment,
        reasoningModel=settings.reasoning_model_deployment,
        agentsAvailable=_AGENT_REGISTRY,
        executionMode="live" if foundry.is_configured else "mock",
        azureOpenAiEndpoint=_mask_endpoint(settings.azure_openai_endpoint),
    )


# ─── POST /api/agents/test ────────────────────────────────────────────────────

@router.post(
    "/agents/test",
    response_model=AgentTestResponse,
    summary="Run specialist agents against a test incident",
    description=(
        "Runs MetricsAgent, LogsAgent, and DeploymentAgent concurrently against "
        "the supplied incident description. When AZURE_OPENAI_ENDPOINT is set the "
        "agents call Azure OpenAI; otherwise they return deterministic mock findings. "
        "All three agents are always executed regardless of Foundry configuration."
    ),
    responses={
        422: {"description": "Incident description too short (min 10 characters)"},
    },
)
async def test_agents(body: AgentTestRequest) -> AgentTestResponse:
    foundry = get_foundry_client()
    stream = get_event_stream()
    incident_id = f"TEST-{int(time.monotonic() * 1000)}"

    log.info(
        "agents.test.started",
        incident_id=incident_id,
        mode="live" if foundry.is_configured else "mock",
        incident_preview=body.incident[:80],
    )

    state = OpsPilotState(
        incident_id=incident_id,
        incident_description=body.incident,
        severity=Severity.P1,
        affected_services=["checkout-service"],
        timeline=[],
        recommendations=[],
        agent_status={},
        messages=[],
        created_at=datetime.now(timezone.utc),
    )

    stream.open(incident_id)

    agents = [
        MetricsAgent(foundry, stream),
        LogsAgent(foundry, stream),
        DeploymentAgent(foundry, stream),
    ]

    t0 = time.monotonic()
    findings = await asyncio.gather(*[a.run(state) for a in agents], return_exceptions=True)
    total_ms = round((time.monotonic() - t0) * 1000, 1)

    # Drain and discard queued SSE events — this is a test endpoint, not a stream
    await stream.close(incident_id)

    results: list[AgentRunResult] = []
    mode = "live" if foundry.is_configured else "mock"

    for agent, finding in zip(agents, findings):
        if isinstance(finding, BaseException):
            log.error(
                "agents.test.agent_failed",
                agent=agent.role,
                error=str(finding),
            )
            results.append(
                AgentRunResult(
                    agent=agent.role,
                    roleLabel=agent.role_label,
                    mode=mode,
                    confidence=0.0,
                    summary=f"Agent failed: {finding}",
                    evidence=[],
                    durationMs=0.0,
                    metadata={"error": str(finding)},
                )
            )
        else:
            results.append(
                AgentRunResult(
                    agent=finding.role,
                    roleLabel=agent.role_label,
                    mode=mode,
                    confidence=finding.confidence,
                    summary=finding.summary,
                    evidence=finding.evidence,
                    durationMs=finding.metadata.pop("_duration_ms", 0.0),
                    metadata=finding.metadata,
                )
            )

    log.info(
        "agents.test.completed",
        incident_id=incident_id,
        total_duration_ms=total_ms,
        mode=mode,
        confidences={r.agent: r.confidence for r in results},
    )

    return AgentTestResponse(
        incident=body.incident,
        timestamp=datetime.now(timezone.utc).isoformat(),
        foundryConfigured=foundry.is_configured,
        results=results,
        totalDurationMs=total_ms,
    )

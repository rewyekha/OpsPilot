"""Investigation execution router (real, user-triggered).

Endpoints:
  POST /api/incidents/{incident_id}/investigate     — re-run the full agent graph
  POST /api/incidents/{incident_id}/deep-reasoning  — run the o4-mini reasoning agent

Both reuse the existing agent orchestration (no simulation). In foundry mode they
make real Azure OpenAI (o4-mini) calls; progress streams over the existing SSE
channel (GET /api/incidents/{id}/stream).
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agents.orchestrator import investigation_active
from app.providers.factory import provider_is_live
from app.services import incident_service
from app.services.investigation_runner import run_deep_reasoning, trigger_investigation

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/incidents", tags=["investigations"])


# ── Re-run investigation ──────────────────────────────────────────────────────


class InvestigateResponse(BaseModel):
    incident_id: str
    status: str = Field(description="'started' | 'already_running'")
    mode: str = Field(description="'live' (real o4-mini) | 'mock'")


@router.post(
    "/{incident_id}/investigate",
    response_model=InvestigateResponse,
    summary="Re-run the full agent investigation",
    description=(
        "Launches the InvestigationOrchestrator (commander → metrics → logs → "
        "deployment → time_machine → root_cause → [deep_reasoning] → "
        "recommendation) as a background task. Real agent execution; progress is "
        "emitted over the incident's SSE stream. No-op if a run is already in flight."
    ),
)
async def investigate(incident_id: str) -> InvestigateResponse:
    incident = await incident_service.get_incident_by_id(incident_id)
    description = getattr(incident, "description", incident_id) if incident else incident_id
    services = getattr(incident, "affected_services", []) if incident else []

    status = trigger_investigation(incident_id, description, services)
    log.info("investigation.investigate", incident_id=incident_id, status=status)
    return InvestigateResponse(
        incident_id=incident_id,
        status=status,
        mode="live" if provider_is_live() else "mock",
    )


# ── Deep reasoning (o4-mini) ──────────────────────────────────────────────────


class FindingInput(BaseModel):
    role: str = Field(description="metrics | logs | deployment | root_cause | …")
    summary: str = ""
    evidence: list[str] = Field(default_factory=list)
    confidence: float = 0.0


class DeepReasoningRequest(BaseModel):
    incident_description: str = Field(default="", description="Incident description")
    findings: list[FindingInput] = Field(
        default_factory=list,
        description="Specialist findings (metrics/logs/deployment) to reason over",
    )
    root_cause: FindingInput | None = Field(
        default=None, description="Current (low-confidence) root cause to refine"
    )


class DeepReasoningResponse(BaseModel):
    incident_id: str
    title: str
    description: str
    confidence: float
    blast_radius: int
    affected_users: int
    hourly_impact_usd: float
    evidence: list[str]
    reasoning_trace: str
    mode: str


def _finding_dict(f: FindingInput | None) -> dict | None:
    if f is None:
        return None
    return {"summary": f.summary, "evidence": f.evidence, "confidence": f.confidence}


@router.post(
    "/{incident_id}/deep-reasoning",
    response_model=DeepReasoningResponse,
    summary="Run deep reasoning (o4-mini) over the current findings",
    description=(
        "Sends the specialist findings + current root cause to the DeepReasoningAgent "
        "(REASONING/o4-mini role) and returns a refined root cause with a chain-of-"
        "thought reasoning trace. Real model execution in foundry mode; emits SSE "
        "progress events."
    ),
)
async def deep_reasoning(incident_id: str, body: DeepReasoningRequest) -> DeepReasoningResponse:
    by_role = {f.role.lower(): f for f in body.findings}
    description = body.incident_description or incident_id

    log.info(
        "investigation.deep_reasoning.requested",
        incident_id=incident_id,
        finding_count=len(body.findings),
        active=investigation_active(incident_id),
    )

    result = await run_deep_reasoning(
        incident_id=incident_id,
        incident_description=description,
        metrics_findings=_finding_dict(by_role.get("metrics")),
        logs_findings=_finding_dict(by_role.get("logs")),
        deployment_findings=_finding_dict(by_role.get("deployment")),
        root_cause_findings=_finding_dict(body.root_cause),
    )
    log.info(
        "investigation.deep_reasoning.completed",
        incident_id=incident_id,
        confidence=result["confidence"],
        mode=result["mode"],
    )
    return DeepReasoningResponse(**result)

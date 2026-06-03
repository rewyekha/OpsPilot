"""Agent activity router.

Endpoints:
  GET /api/agents/activity?incident_id=  — full agent activity for an incident
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Query, status

from app.models.findings import AgentActivityResponse
from app.services import agent_service

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get(
    "/activity",
    response_model=AgentActivityResponse,
    summary="Get agent activity for an incident",
    description=(
        "Returns the full list of agent tasks, their status, confidence scores, "
        "and findings for the given incident."
    ),
    responses={404: {"description": "Incident not found or no agent activity recorded"}},
)
async def get_agent_activity(
    incident_id: str = Query(..., description="Incident ID, e.g. INC-2024-0847"),
) -> AgentActivityResponse:
    activity = await agent_service.get_agent_activity(incident_id)
    if activity is None:
        log.warning("agents.activity.not_found", incident_id=incident_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No agent activity found for incident '{incident_id}'.",
        )
    log.info("agents.activity.fetched", incident_id=incident_id, agent_count=len(activity.agents))
    return activity

"""Timeline router.

Endpoints:
  GET /api/timeline/{incident_id}  — full investigation timeline for an incident
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, status

from app.models.timeline import TimelineResponse
from app.services import timeline_service

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/timeline", tags=["timeline"])


@router.get(
    "/{incident_id}",
    response_model=TimelineResponse,
    summary="Get investigation timeline",
    description=(
        "Returns the ordered sequence of timeline events for an incident investigation, "
        "including deployment events, detections, correlations, and root cause confirmation."
    ),
    responses={404: {"description": "Incident not found or no timeline available"}},
)
async def get_timeline(incident_id: str) -> TimelineResponse:
    timeline = await timeline_service.get_timeline(incident_id)
    if timeline is None:
        log.warning("timeline.not_found", incident_id=incident_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No timeline found for incident '{incident_id}'.",
        )
    log.info("timeline.fetched", incident_id=incident_id, event_count=len(timeline.events))
    return timeline

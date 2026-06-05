"""Server-Sent Events stream router.

Endpoint:
  GET /api/incidents/{incident_id}/stream

SUBSCRIBE-ONLY. This endpoint never launches an investigation — it only streams
the events of one started explicitly via
`POST /api/incidents/{incident_id}/investigate`. The event bus replays the
retained history first, so connecting, reconnecting, or refreshing shows the
full investigation without ever re-running the agents (no token burn).
"""
from __future__ import annotations

import json

import structlog
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.services import incident_service
from app.services.event_stream import get_event_stream

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/incidents", tags=["stream"])


async def _event_generator(incident_id: str):
    """Subscribe-only: replay history then tail live events. Starts nothing."""
    async for event in get_event_stream().subscribe(incident_id):
        yield f"data: {json.dumps(event)}\n\n"


@router.get(
    "/{incident_id}/stream",
    summary="Stream agent activity events (SSE) — subscribe-only",
    description="Server-Sent Events stream of agent activity. Does NOT launch an investigation.",
    responses={
        200: {"content": {"text/event-stream": {}}},
        404: {"description": "Incident not found"},
    },
)
async def stream_incident(incident_id: str) -> StreamingResponse:
    incident = await incident_service.get_incident_by_id(incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )
    log.info("stream.subscribed", incident_id=incident_id)
    return StreamingResponse(
        _event_generator(incident_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

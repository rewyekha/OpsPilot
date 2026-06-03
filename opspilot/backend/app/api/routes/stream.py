"""Server-Sent Events stream router.

Endpoint:
  GET /api/incidents/{incident_id}/stream

Emits a real-time SSE stream driven by the InvestigationOrchestrator.
When Azure OpenAI is not configured the orchestrator falls back to
deterministic mock data — the SSE event sequence is identical in both paths.
"""
from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.agents.orchestrator import InvestigationOrchestrator
from app.services import incident_service
from app.services.event_stream import get_event_stream

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/incidents", tags=["stream"])


async def _live_event_generator(incident_id: str, incident_description: str, affected_services: list[str]):
    """Runs the orchestrator as a background task and streams its events via SSE."""
    orchestrator = InvestigationOrchestrator()
    event_stream = get_event_stream()

    task = asyncio.create_task(
        orchestrator.run(incident_id, incident_description, affected_services)
    )

    try:
        async for event in event_stream.subscribe(incident_id):
            yield f"data: {json.dumps(event)}\n\n"
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        else:
            # Propagate any unhandled orchestrator exception to the log
            exc = task.exception()
            if exc is not None:
                log.error("orchestrator.error", incident_id=incident_id, error=str(exc))


@router.get(
    "/{incident_id}/stream",
    summary="Stream agent activity events (SSE)",
    description="Server-Sent Events stream of real-time agent activity for an incident.",
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
    log.info("stream.started", incident_id=incident_id)
    return StreamingResponse(
        _live_event_generator(
            incident_id,
            incident_description=getattr(incident, "description", str(incident_id)),
            affected_services=getattr(incident, "affected_services", []),
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

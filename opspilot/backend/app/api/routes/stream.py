"""Server-Sent Events stream router.

Endpoint:
  GET /api/incidents/{incident_id}/stream

READ-ONLY. Streams events for an investigation that is already running. It NEVER
starts a run — only POST /api/incidents/{id}/investigate may do that. Because of
this, reopening the stream (navigation, refresh, SSE reconnect) cannot restart
agent execution: a completed investigation stays completed, and a healthy system
with no active run simply streams nothing.
"""
from __future__ import annotations

import json

import structlog
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.event_stream import get_event_stream

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/incidents", tags=["stream"])


async def _live_event_generator(incident_id: str):
    """Subscribe to (and stream) events for an in-flight run. Starts nothing."""
    event_stream = get_event_stream()
    async for event in event_stream.subscribe(incident_id):
        yield f"data: {json.dumps(event)}\n\n"


@router.get(
    "/{incident_id}/stream",
    summary="Stream agent activity events (SSE, read-only)",
    description=(
        "Server-Sent Events stream of real-time agent activity for an incident. "
        "Read-only: it streams an already-running investigation and never starts "
        "one. Use POST /api/incidents/{id}/investigate to start a run."
    ),
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def stream_incident(incident_id: str) -> StreamingResponse:
    log.info("stream.started", incident_id=incident_id)
    return StreamingResponse(
        _live_event_generator(incident_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

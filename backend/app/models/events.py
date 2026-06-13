"""
Pydantic models for SSE event types emitted to the frontend.

Every significant state change in the LangGraph graph emits a typed SSE event.
The frontend Agent Activity Stream panel renders these events in real-time.

Event envelope:
  {
    "event_type": "agent.finding",
    "incident_id": "INC-<service>",   # real, telemetry-derived id (never seeded)
    "timestamp": "2026-06-06T14:27:03Z",
    "payload": { ... }
  }
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel


class EventType(str, Enum):
    AGENT_STARTED = "agent.started"
    AGENT_TOOL_CALLED = "agent.tool_called"
    AGENT_TOOL_RESULT = "agent.tool_result"
    AGENT_FINDING = "agent.finding"
    AGENT_COMPLETED = "agent.completed"
    AGENT_FAILED = "agent.failed"
    TIMELINE_EVENT_ADDED = "timeline.event_added"
    ROOT_CAUSE_UPDATED = "root_cause.updated"
    RECOMMENDATIONS_READY = "recommendations.ready"
    INVESTIGATION_COMPLETE = "investigation.complete"


class SSEEvent(BaseModel):
    event_type: EventType
    incident_id: str
    timestamp: datetime = datetime.utcnow()
    agent_name: str | None = None
    payload: dict[str, Any] = {}

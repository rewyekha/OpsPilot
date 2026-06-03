"""Pydantic models for the investigation timeline."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TimelineEventType(str, Enum):
    DEPLOYMENT = "deployment"
    INCIDENT = "incident"
    DETECTION = "detection"
    CORRELATION = "correlation"
    ROOT_CAUSE = "root_cause"
    MITIGATION = "mitigation"
    RESOLUTION = "resolution"


class TimelineEvent(BaseModel):
    """A single event on the investigation timeline."""

    id: str
    incident_id: str
    type: TimelineEventType
    type_label: str
    title: str
    description: str
    timestamp: datetime
    relative_time: str = Field(description="Human-readable relative offset, e.g. 'T-20 min'")
    confidence: float = Field(ge=0.0, le=100.0)
    is_key_event: bool = False
    agent_role: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class TimelineResponse(BaseModel):
    incident_id: str
    events: list[TimelineEvent]

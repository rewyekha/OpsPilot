"""Pydantic models for agent task tracking and findings."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AgentRole(str, Enum):
    COMMANDER = "commander"
    METRICS = "metrics"
    LOGS = "logs"
    DEPLOYMENT = "deployment"
    TIME_MACHINE = "time_machine"


class AgentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    WAITING = "waiting"


class AgentFinding(BaseModel):
    """A single structured finding emitted by a specialist agent."""

    summary: str
    evidence: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=100.0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentTask(BaseModel):
    """Represents one agent's participation in an incident investigation."""

    id: str
    incident_id: str
    role: AgentRole
    role_label: str
    status: AgentStatus
    confidence: float = Field(ge=0.0, le=100.0, default=0.0)
    finding: str = ""
    evidence: list[str] = Field(default_factory=list)
    tools_called: list[str] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: float | None = None


class AgentActivityResponse(BaseModel):
    """Aggregated agent activity for an incident investigation."""

    incident_id: str
    total_dispatched: int
    completed: int
    running: int
    waiting: int
    agents: list[AgentTask]

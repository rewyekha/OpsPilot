"""
Pydantic domain models — Incident.

Incident is the top-level entity representing a production event under investigation.
It is persisted to Azure Cosmos DB and drives all downstream agent activity.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"
    POST_MORTEM = "post_mortem"


class IncidentSeverity(str, Enum):
    P0 = "P0"   # Complete outage, all users affected
    P1 = "P1"   # Major degradation, significant user impact
    P2 = "P2"   # Partial degradation, some users affected
    P3 = "P3"   # Minor issue, minimal user impact


class CreateIncidentRequest(BaseModel):
    description: str = Field(min_length=10, max_length=2000)
    affected_services: list[str] = Field(default_factory=list)
    reported_severity: IncidentSeverity = IncidentSeverity.P1
    reporter: str = "anonymous"


class IncidentRecord(BaseModel):
    id: str
    description: str
    status: IncidentStatus = IncidentStatus.OPEN
    severity: IncidentSeverity
    affected_services: list[str]
    reporter: str
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
    langgraph_run_id: str | None = None     # links to LangGraph checkpoint
    error_rate_pct: float | None = None     # current service error rate (0-100)

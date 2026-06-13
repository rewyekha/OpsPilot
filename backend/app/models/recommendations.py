"""Pydantic models for root cause analysis and remediation recommendations."""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    SAFE = "safe"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ImpactLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RootCause(BaseModel):
    """Confirmed root cause identified by the Commander agent."""

    incident_id: str
    title: str
    description: str
    confidence: float = Field(ge=0.0, le=100.0)
    blast_radius: int = Field(ge=0, description="Number of services directly affected")
    affected_users: int = Field(ge=0)
    hourly_impact_usd: float = Field(ge=0.0)
    evidence: list[str] = Field(default_factory=list)


class RecommendedAction(BaseModel):
    """A single prioritised remediation action."""

    id: str
    incident_id: str
    priority: int = Field(ge=1, le=10)
    type: str
    type_label: str
    title: str
    description: str
    steps: list[str] = Field(default_factory=list)
    risk: RiskLevel
    risk_label: str
    impact: ImpactLevel
    impact_label: str
    estimated_time: str


class RecommendationResponse(BaseModel):
    """Full recommendation payload for an incident."""

    incident_id: str
    root_cause: RootCause
    actions: list[RecommendedAction]

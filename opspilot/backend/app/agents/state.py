"""
LangGraph state schema for OpsPilot investigations.

OpsPilotState is the single source of truth flowing through all graph nodes.
Each agent reads the full state and writes only to its designated output keys.
The Commander reads all agent findings to produce the final synthesis.

Design rules:
  - All fields are Optional; agents set them to non-None when complete.
  - Confidence scores range 0.0–1.0. Scores below 0.7 trigger deep_reasoning.
  - The `messages` field uses LangGraph's add_messages reducer for append-only updates.
  - The `agent_status` dict tracks per-agent lifecycle for the SSE stream.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Any

from langgraph.graph.message import add_messages
from pydantic import BaseModel, ConfigDict, Field


class Severity(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class AgentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    SKIPPED = "skipped"


class TimelineEvent(BaseModel):
    timestamp: datetime
    source: str                     # "metrics" | "logs" | "deployment" | "infra"
    description: str
    severity: str                   # "info" | "warning" | "critical"
    evidence_refs: list[str] = Field(default_factory=list)


class RootCauseHypothesis(BaseModel):
    hypothesis: str
    confidence: float               # 0.0–1.0
    supporting_evidence: list[str]
    contradicting_evidence: list[str]


class RootCauseAssessment(BaseModel):
    primary: RootCauseHypothesis
    alternatives: list[RootCauseHypothesis] = Field(default_factory=list)
    reasoning_trace: str            # chain-of-thought from Commander


class BlastRadiusAssessment(BaseModel):
    affected_services: list[str]
    affected_users_estimate: int
    affected_regions: list[str]
    downstream_dependencies: list[str]
    business_impact_usd_per_hour: float


class Recommendation(BaseModel):
    priority: int                   # 1 = highest
    timeframe: str                  # "immediate" | "short-term" | "long-term"
    action: str
    rationale: str
    confidence: float


class OpsPilotState(BaseModel):
    """Full investigation state. Passed through every LangGraph node."""

    model_config = ConfigDict(frozen=False, arbitrary_types_allowed=True)

    # ── Input ────────────────────────────────────────────────────────────────
    incident_id: str
    incident_description: str
    severity: Severity = Severity.P1
    affected_services: list[str] = Field(default_factory=list)

    # ── Agent findings (set by each specialist agent) ────────────────────────
    metrics_findings: dict[str, Any] | None = None
    logs_findings: dict[str, Any] | None = None
    deployment_findings: dict[str, Any] | None = None
    infra_findings: dict[str, Any] | None = None

    # ── Synthesized outputs (set by Commander during synthesis) ─────────────
    timeline: list[Any] = Field(default_factory=list)  # list[TimelineEvent] or raw dicts
    root_cause: RootCauseAssessment | None = None
    blast_radius: BlastRadiusAssessment | None = None
    recommendations: list[Recommendation] = Field(default_factory=list)
    executive_summary: str | None = None

    # ── Orchestration metadata ────────────────────────────────────────────────
    agent_status: dict[str, AgentStatus] = Field(default_factory=dict)
    messages: Annotated[list[Any], add_messages] = Field(default_factory=list)
    iteration_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None

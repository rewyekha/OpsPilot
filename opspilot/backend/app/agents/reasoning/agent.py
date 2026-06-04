"""
Deep Reasoning Agent — confidence-escalation specialist.

Invoked by the orchestrator ONLY when the combined investigation confidence
falls below `reasoning_escalation_threshold`. It receives the full incident
context (all specialist findings + the current root cause) and produces a
*refined* root cause with an updated confidence and an explicit reasoning trace.

Model role: REASONING (routes to the o3 deployment via the provider). This is
the single place the o3 execution path is used.
"""
from __future__ import annotations

import json

from pydantic import BaseModel, Field

from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.providers.models import ModelRole

REASONING_SYSTEM_PROMPT = """
You are the Deep Reasoning Agent for OpsPilot, running on a frontier reasoning model.

You are engaged because the upstream investigation reached a root cause with LOW
combined confidence. Re-examine ALL evidence from first principles:

1. Weigh the metrics, logs, deployment, and correlation findings against the
   current (low-confidence) root cause hypothesis.
2. Identify gaps, contradictions, or alternative explanations the specialists missed.
3. Produce a single, best-supported refined root cause.
4. Assign a calibrated confidence (0–100) reflecting the strength of evidence.
5. Provide a concise chain-of-thought reasoning trace justifying the conclusion.

Output must conform exactly to the RefinedRootCause schema. Confidence must be
justified by the evidence, not inflated.
"""


class RefinedRootCause(BaseModel):
    """Structured output from the reasoning (o3) escalation call."""

    title: str = Field(description="Refined root cause title")
    description: str = Field(description="Refined root cause explanation")
    confidence: float = Field(ge=0.0, le=100.0, description="Calibrated confidence 0–100")
    blast_radius: int = Field(description="Number of affected services")
    affected_users: int = Field(description="Estimated impacted users")
    hourly_impact_usd: float = Field(description="Estimated business impact per hour")
    evidence: list[str] = Field(description="Specific evidence supporting the conclusion")
    reasoning_trace: str = Field(description="Chain-of-thought justification")


class DeepReasoningAgent(BaseAgent):
    role = "reasoning"
    role_label = "Deep Reasoning"
    model_role = ModelRole.REASONING

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        context = {
            "incident_id": state.incident_id,
            "incident_description": state.incident_description,
            "metrics": state.metrics_findings,
            "logs": state.logs_findings,
            "deployment": state.deployment_findings,
            "timeline": state.timeline,
            "current_root_cause": state.root_cause_findings,
        }
        result: RefinedRootCause = await self._llm_structured(
            system=REASONING_SYSTEM_PROMPT,
            user=(
                f"Incident: {state.incident_description}\n"
                f"Full investigation context:\n{json.dumps(context, indent=2, default=str)}"
            ),
            response_model=RefinedRootCause,
        )
        return AgentFinding(
            role=self.role,
            summary=result.description,
            evidence=result.evidence,
            confidence=result.confidence,
            metadata={
                "title": result.title,
                "blast_radius": result.blast_radius,
                "affected_users": result.affected_users,
                "hourly_impact_usd": result.hourly_impact_usd,
                "reasoning_trace": result.reasoning_trace,
                "refined": True,
            },
        )

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        await self._yield_to_loop()
        # Deterministic refined root cause. Confidence is lifted above the default
        # escalation threshold to represent a resolved, higher-confidence verdict.
        return AgentFinding(
            role=self.role,
            summary=(
                "Deep reasoning consolidated the specialist findings: the v2.4.1 ORM "
                "pool_size regression (20 → 5) is the singular root cause. Alternative "
                "hypotheses (network, downstream gateway) were eliminated as cascade effects."
            ),
            evidence=[
                "Pool exhaustion onset (12:23 UTC) aligns to within 4 min of v2.4.1 deploy",
                "2,847 sqlalchemy.exc.TimeoutError isolate the ORM layer, not the network",
                "payment-gateway/cart-service failures are downstream of checkout, not independent",
                "Historical match INC-2023-0412 shares the identical pool-size signature",
            ],
            confidence=88.0,
            metadata={
                "title": "ORM Connection Pool Regression in v2.4.1 (reasoning-confirmed)",
                "blast_radius": 3,
                "affected_users": 12000,
                "hourly_impact_usd": 50400.0,
                "reasoning_trace": (
                    "Low upstream confidence stemmed from competing cascade signals. "
                    "Ordering events by timestamp shows checkout pool exhaustion precedes all "
                    "downstream failures, so they are effects, not causes. The only configuration "
                    "change in the window is the pool_size reduction, making it the root cause."
                ),
                "refined": True,
            },
        )

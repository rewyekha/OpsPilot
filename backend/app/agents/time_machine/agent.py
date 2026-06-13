"""
Correlation Agent (Time Machine) — unified causal timeline builder.

Reads findings from Metrics, Logs, and Deployment agents and synthesizes
a single chronologically ordered event timeline with causal annotations.

This agent runs AFTER the three specialist agents complete (fan-in).
It does not call external tools — it reasons purely over collected state.

Model: commander (GPT-4o) — needs full context across all three finding sets.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.providers.models import ModelRole
from app.agents.commander.prompts import CORRELATION_SYSTEM_PROMPT


class TimelineItem(BaseModel):
    timestamp: str
    type: str  # deployment | incident | detection | correlation | root_cause
    title: str
    description: str
    is_key_event: bool
    agent_role: str | None = None
    confidence: float = Field(ge=0.0, le=100.0, default=80.0)


class CorrelationOutput(BaseModel):
    """Structured output from the Correlation Agent LLM call."""

    timeline: list[TimelineItem]
    moment_of_failure: str = Field(description="ISO-8601 timestamp when failure cascade began")
    blast_propagation: list[str] = Field(description="Ordered list of services in failure cascade")
    causal_summary: str = Field(description="2-3 sentence causal chain description")
    confidence: float = Field(ge=0.0, le=100.0)


class CorrelationAgent(BaseAgent):
    """Also exported as TimeMachineAgent for backward compatibility."""

    role = "time_machine"
    role_label = "Correlation"
    # Phase 2 routing table assigns the Time Machine agent to the SPECIALIST tier.
    model_role = ModelRole.SPECIALIST

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        findings_data = {
            "metrics": state.metrics_findings,
            "logs": state.logs_findings,
            "deployment": state.deployment_findings,
            "incident_id": state.incident_id,
            "incident_description": state.incident_description,
        }

        result: CorrelationOutput = await self._llm_structured(
            system=CORRELATION_SYSTEM_PROMPT,
            user=(
                f"Incident: {state.incident_description}\n"
                f"All specialist findings:\n{json.dumps(findings_data, indent=2)}"
            ),
            response_model=CorrelationOutput,
        )

        return AgentFinding(
            role=self.role,
            summary=result.causal_summary,
            evidence=result.blast_propagation,
            confidence=result.confidence,
            metadata={
                "timeline": [item.model_dump() for item in result.timeline],
                "moment_of_failure": result.moment_of_failure,
            },
        )

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        await self._yield_to_loop()
        now_base = "2026-06-03T12:"
        return AgentFinding(
            role=self.role,
            summary=(
                "Correlated timeline: v2.4.1 deploy at 12:19 UTC introduced pool_size=5. "
                "DB pool exhausted at 12:20 UTC triggering checkout-service errors at 12:23 UTC. "
                "payment-gateway and cart-service cascaded within 2 minutes."
            ),
            evidence=[
                "checkout-service",
                "payment-gateway",
                "cart-service",
            ],
            confidence=92.0,
            metadata={
                "moment_of_failure": "2026-06-03T12:20:00+00:00",
                "timeline": [
                    {
                        "timestamp": f"{now_base}19:00+00:00",
                        "type": "deployment",
                        "title": "Deployment v2.4.1 Released to Production",
                        "description": "Automated pipeline promoted checkout-service v2.4.1. pool_size reduced to 5.",
                        "is_key_event": True,
                        "agent_role": "deployment",
                        "confidence": 100.0,
                    },
                    {
                        "timestamp": f"{now_base}23:00+00:00",
                        "type": "detection",
                        "title": "Metrics Agent Detected Error Rate Spike",
                        "description": "73.4% error rate and 1,847ms p99 latency detected. DB pool at ceiling.",
                        "is_key_event": True,
                        "agent_role": "metrics",
                        "confidence": 91.0,
                    },
                    {
                        "timestamp": f"{now_base}23:00+00:00",
                        "type": "detection",
                        "title": "Logs Agent Confirmed Connection Pool Exhaustion",
                        "description": "2,847 sqlalchemy.exc.TimeoutError; pool_size=5 misconfiguration confirmed.",
                        "is_key_event": True,
                        "agent_role": "logs",
                        "confidence": 89.0,
                    },
                    {
                        "timestamp": f"{now_base}25:00+00:00",
                        "type": "correlation",
                        "title": "Correlation: Deploy -> Pool Exhaustion -> Error Cascade",
                        "description": "Causal chain confirmed: v2.4.1 config regression caused pool exhaustion and downstream failures.",
                        "is_key_event": True,
                        "agent_role": "time_machine",
                        "confidence": 92.0,
                    },
                ],
            },
        )


# Alias for import compatibility
TimeMachineAgent = CorrelationAgent

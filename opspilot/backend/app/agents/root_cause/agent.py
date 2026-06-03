from __future__ import annotations
import json
from pydantic import BaseModel, Field
from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.agents.commander.prompts import ROOT_CAUSE_SYSTEM_PROMPT


class RootCauseOutput(BaseModel):
    title: str
    description: str
    confidence: float = Field(ge=0.0, le=100.0)
    blast_radius: int
    affected_users: int
    hourly_impact_usd: float
    evidence: list[str]


class RootCauseAgent(BaseAgent):
    role = "root_cause"
    role_label = "Root Cause"
    model_key = "commander"

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        context = {
            "metrics": state.metrics_findings,
            "logs": state.logs_findings,
            "deployment": state.deployment_findings,
            "incident_id": state.incident_id,
            "incident_description": state.incident_description,
        }
        result: RootCauseOutput = await self._llm_structured(
            system=ROOT_CAUSE_SYSTEM_PROMPT,
            user=(
                f"Incident: {state.incident_description}\n"
                f"All findings:\n{json.dumps(context, indent=2)}"
            ),
            response_model=RootCauseOutput,
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
            },
        )

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        await self._yield_to_loop()
        return AgentFinding(
            role=self.role,
            summary=(
                "ORM connection pool misconfiguration in v2.4.1 reduced pool_size from 20 to 5, "
                "causing exhaustion under normal load and triggering a cascade across 3 services."
            ),
            evidence=[
                "deploy-checkout-v241: SQLALCHEMY_POOL_SIZE 20 -> 5 (commit a3f9c12)",
                "73.4% error rate in checkout-service within 4 minutes of deploy",
                "2,847 sqlalchemy.exc.TimeoutError in 6-minute window",
                "payment-gateway and cart-service downstream failures confirmed",
            ],
            confidence=94.0,
            metadata={
                "title": "ORM Connection Pool Regression in v2.4.1",
                "blast_radius": 3,
                "affected_users": 12000,
                "hourly_impact_usd": 50400.0,
            },
        )

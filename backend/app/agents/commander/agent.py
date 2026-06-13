from __future__ import annotations
import json
from pydantic import BaseModel, Field
from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.providers.models import ModelRole
from app.agents.commander.prompts import COMMANDER_INTAKE_SYSTEM_PROMPT


class IntakeOutput(BaseModel):
    severity: str = Field(description="P0 | P1 | P2 | P3")
    affected_services: list[str] = Field(description="Services likely affected based on incident description")
    incident_type: str = Field(description="database | network | deployment | application | infrastructure | unknown")
    urgency_summary: str = Field(description="One sentence triage summary")
    confidence: float = Field(ge=0.0, le=100.0)


class CommanderAgent(BaseAgent):
    """
    Intake classification agent.

    Parses severity, affected services, and incident type from the raw
    incident description. Runs before specialist agents so the orchestrator
    can populate state.affected_services properly.
    """

    role = "commander"
    role_label = "Commander"
    model_role = ModelRole.COMMANDER

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        result: IntakeOutput = await self._llm_structured(
            system=COMMANDER_INTAKE_SYSTEM_PROMPT,
            user=f"Incident report:\n{state.incident_description}",
            response_model=IntakeOutput,
        )
        return AgentFinding(
            role=self.role,
            summary=result.urgency_summary,
            evidence=result.affected_services,
            confidence=result.confidence,
            metadata={
                "severity": result.severity,
                "affected_services": result.affected_services,
                "incident_type": result.incident_type,
            },
        )

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        await self._yield_to_loop()
        return AgentFinding(
            role=self.role,
            summary="P1 incident: checkout-service database connection pool exhaustion following v2.4.1 deployment. Initiating specialist investigation.",
            evidence=["checkout-service", "payment-gateway", "cart-service"],
            confidence=94.0,
            metadata={
                "severity": "P1",
                "affected_services": ["checkout-service", "payment-gateway", "cart-service"],
                "incident_type": "database",
            },
        )

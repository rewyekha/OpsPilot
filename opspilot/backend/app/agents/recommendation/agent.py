from __future__ import annotations
import json
from pydantic import BaseModel, Field
from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.agents.commander.prompts import RECOMMENDATION_SYSTEM_PROMPT


class ActionItem(BaseModel):
    id: str
    type: str
    type_label: str
    title: str
    description: str
    steps: list[str]
    risk: str
    risk_label: str
    impact: str
    impact_label: str
    estimated_time: str
    priority: int


class RecommendationOutput(BaseModel):
    actions: list[ActionItem]


class RecommendationAgent(BaseAgent):
    role = "recommendation"
    role_label = "Recommendation"
    model_key = "commander"

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        context = {
            "metrics": state.metrics_findings,
            "logs": state.logs_findings,
            "deployment": state.deployment_findings,
            "incident_id": state.incident_id,
            "incident_description": state.incident_description,
        }
        result: RecommendationOutput = await self._llm_structured(
            system=RECOMMENDATION_SYSTEM_PROMPT,
            user=(
                f"Incident: {state.incident_description}\n"
                f"All findings:\n{json.dumps(context, indent=2)}"
            ),
            response_model=RecommendationOutput,
        )
        return AgentFinding(
            role=self.role,
            summary=f"{len(result.actions)} remediation action(s) identified.",
            evidence=[a.title for a in result.actions],
            confidence=90.0,
            metadata={"actions": [a.model_dump() for a in result.actions]},
        )

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        await self._yield_to_loop()
        mock_actions = [
            {
                "id": "rec-001",
                "type": "rollback",
                "type_label": "Rollback",
                "title": "Immediate Rollback to v2.4.0",
                "description": "Roll back checkout-service to the last known stable version v2.4.0 to restore database connection pool to 20.",
                "steps": [
                    "Run: kubectl rollout undo deployment/checkout-service",
                    "Monitor error rate — should drop below 1% within 60 seconds",
                    "Verify DB connections in Grafana",
                    "Notify on-call team of rollback completion",
                ],
                "risk": "safe",
                "risk_label": "Safe",
                "impact": "critical",
                "impact_label": "Critical",
                "estimated_time": "2-3 minutes",
                "priority": 1,
            },
            {
                "id": "rec-002",
                "type": "fix",
                "type_label": "Hotfix",
                "title": "Hotfix: Restore SQLALCHEMY_POOL_SIZE=20",
                "description": "If rollback is not viable, deploy a targeted hotfix that restores the correct pool size via environment variable override.",
                "steps": [
                    "Update deployment config: SQLALCHEMY_POOL_SIZE=20",
                    "Apply: kubectl set env deployment/checkout-service SQLALCHEMY_POOL_SIZE=20",
                    "Trigger rolling restart",
                    "Confirm pool utilization drops below 80%",
                ],
                "risk": "medium",
                "risk_label": "Medium Risk",
                "impact": "critical",
                "impact_label": "Critical",
                "estimated_time": "5-10 minutes",
                "priority": 2,
            },
            {
                "id": "rec-003",
                "type": "infrastructure",
                "type_label": "Infrastructure",
                "title": "Add Connection Pool Monitoring Alert",
                "description": "Add a Prometheus alert for DB connection pool utilization > 80% to prevent future incidents.",
                "steps": [
                    "Add metric: db_connection_pool_utilization_pct",
                    "Configure alert: threshold 80% for > 2 minutes",
                    "Route to PagerDuty oncall-db channel",
                    "Test alert in staging",
                ],
                "risk": "medium",
                "risk_label": "Medium Risk",
                "impact": "high",
                "impact_label": "High",
                "estimated_time": "30-60 minutes",
                "priority": 3,
            },
        ]
        return AgentFinding(
            role=self.role,
            summary="3 remediation actions identified: immediate rollback, hotfix, and monitoring improvement.",
            evidence=["Rollback to v2.4.0 (safe, immediate)", "Hotfix pool_size env var", "Add pool utilization alert"],
            confidence=93.0,
            metadata={"actions": mock_actions},
        )

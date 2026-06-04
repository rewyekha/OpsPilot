"""
Deployment Agent — change correlation and configuration diff specialist.

Retrieves deployments in the past 24 hours, identifies the most recent
deployment preceding the incident, and extracts critical configuration changes.

Model: specialist (GPT-4o-mini)
Tools: get_recent_deployments, get_config_diff
"""
from __future__ import annotations

import json

from pydantic import BaseModel, Field

from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.providers.models import ModelRole
from app.tools.deployment_tools import get_config_diff, get_recent_deployments

DEPLOYMENT_SYSTEM_PROMPT = """
You are the Deployment Agent for OpsPilot. Analyze recent deployments and config diffs.

Given deployment history and configuration changes, you must:
1. Identify the most recent deployment before the incident onset
2. Extract all configuration changes, prioritising any that could cause the reported symptoms
3. Assess whether the deployment is the probable cause (timeline correlation)
4. Identify the specific commit and changed files
5. Write a concise 2-3 sentence summary citing version numbers and config keys

All evidence must reference specific deployment IDs, versions, commit SHAs, or config keys.
Output must conform exactly to the DeploymentAnalysis schema.
"""


class ConfigChange(BaseModel):
    key: str
    before: str
    after: str
    impact: str


class DeploymentAnalysis(BaseModel):
    """Structured output from the Deployment Agent LLM call."""

    suspect_deployment_id: str = Field(description="ID of the deployment most likely causing the incident")
    suspect_version: str = Field(description="Version string of the suspect deployment")
    deployed_at: str = Field(description="ISO-8601 deploy timestamp")
    commit_sha: str = Field(description="Git commit SHA")
    critical_config_changes: list[ConfigChange] = Field(
        description="Config changes with potential impact"
    )
    timeline_correlation: bool = Field(
        description="True if deployment timestamp correlates with incident onset"
    )
    summary: str = Field(description="2-3 sentence deployment finding summary")
    evidence: list[str] = Field(description="Specific evidence items")
    confidence: float = Field(ge=0.0, le=100.0)


class DeploymentAgent(BaseAgent):
    role = "deployment"
    role_label = "Deployment"
    model_role = ModelRole.SPECIALIST

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        services = state.affected_services or ["checkout-service"]
        primary = services[0]

        deployments = get_recent_deployments(primary, hours_back=24)
        deploys_data = [
            {
                "id": d.id,
                "version": d.version,
                "deployed_at": d.deployed_at,
                "commit_sha": d.commit_sha,
                "commit_message": d.commit_message,
                "changed_files": d.changed_files,
                "config_changes": d.config_changes,
            }
            for d in deployments
        ]

        config_diff = {}
        if deployments:
            config_diff = get_config_diff(deployments[0].id)

        tool_data = {
            "recent_deployments": deploys_data,
            "config_diff_latest": config_diff,
            "incident_onset": "2026-06-03T12:23:00+00:00",
        }

        result: DeploymentAnalysis = await self._llm_structured(
            system=DEPLOYMENT_SYSTEM_PROMPT,
            user=(
                f"Incident: {state.incident_description}\n"
                f"Service: {primary}\n"
                f"Deployment data:\n{json.dumps(tool_data, indent=2)}"
            ),
            response_model=DeploymentAnalysis,
        )

        return AgentFinding(
            role=self.role,
            summary=result.summary,
            evidence=result.evidence,
            confidence=result.confidence,
            metadata={
                "suspect_version": result.suspect_version,
                "deployed_at": result.deployed_at,
                "commit_sha": result.commit_sha,
                "config_changes": [
                    {"key": c.key, "before": c.before, "after": c.after}
                    for c in result.critical_config_changes
                ],
                "timeline_correlation": result.timeline_correlation,
            },
        )

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        await self._yield_to_loop()
        return AgentFinding(
            role=self.role,
            summary=(
                "Deployment v2.4.1 (commit a3f9c12) shipped 4 minutes before incident onset. "
                "SQLALCHEMY_POOL_SIZE reduced from 20 → 5 via automated sqlalchemy 2.0.35 migration. "
                "Strong temporal correlation: error onset at T+4 min post-deploy."
            ),
            evidence=[
                "deploy-checkout-v241 at 12:19 UTC, incident onset at 12:23 UTC (4-min gap)",
                "commit a3f9c12: chore: bump sqlalchemy dependency to 2.0.35 (automated)",
                "app/config/database.py SQLALCHEMY_POOL_SIZE: 20 → 5",
                "v2.4.0 (14 days stable, pool_size=20) was the last healthy build",
            ],
            confidence=96.0,
            metadata={
                "suspect_version": "v2.4.1",
                "deployed_at": "2026-06-03T12:19:00+00:00",
                "commit_sha": "a3f9c12",
                "config_changes": [
                    {"key": "SQLALCHEMY_POOL_SIZE", "before": "20", "after": "5"}
                ],
                "timeline_correlation": True,
            },
        )

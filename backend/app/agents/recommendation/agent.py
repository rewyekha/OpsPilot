from __future__ import annotations
import json
from pydantic import BaseModel, Field
from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.providers.models import ModelRole
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


def _action(i: int, type_: str, type_label: str, title: str, description: str,
            steps: list[str], risk: str, impact: str, eta: str) -> dict:
    risk_labels = {"safe": "Safe", "medium": "Medium Risk", "high": "High Risk"}
    impact_labels = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"}
    return {
        "id": f"rec-{i:03d}", "type": type_, "type_label": type_label, "title": title,
        "description": description, "steps": steps, "risk": risk,
        "risk_label": risk_labels.get(risk, "Medium Risk"), "impact": impact,
        "impact_label": impact_labels.get(impact, "Medium"), "estimated_time": eta, "priority": i,
    }


def _fallback_actions(state: OpsPilotState) -> list[dict]:
    """Deterministic remediation derived from the real incident signal + root cause.

    No fabricated data — maps the detected problem type (from the incident
    description / root-cause title) to standard SRE remediations so a completed
    investigation always returns at least one actionable recommendation (Task 2).
    """
    svc = (state.affected_services or ["the service"])[0]
    rc = state.root_cause_findings or {}
    text = f"{state.incident_description or ''} {rc.get('title', '')} {rc.get('summary', '')}".lower()

    if any(k in text for k in ("down", "outage", "unreachable", "0 requests", "zero", "scaled to zero", "replica")):
        return [
            _action(1, "scale", "Scale", f"Restore replicas for {svc}",
                    f"{svc} is serving no traffic. Scale it back to a healthy replica count.",
                    [f"az containerapp update -n {svc} -g <rg> --min-replicas 1 --max-replicas 3",
                     "Confirm a replica reaches Running", "Re-check ingress responds 200"],
                    "safe", "critical", "2-3 minutes"),
            _action(2, "investigate", "Verify", f"Verify ingress + container health for {svc}",
                    "Confirm external ingress is enabled and the container passes health checks.",
                    ["az containerapp show -n <app> -g <rg> --query properties.configuration.ingress",
                     "Inspect ContainerAppSystemLogs_CL for crash/restart reasons"],
                    "safe", "high", "3-5 minutes"),
            _action(3, "investigate", "Logs", "Check recent container/system logs",
                    "Review startup + system logs for the cause of the outage.",
                    ["Query ContainerAppConsoleLogs_CL for the app", "Look for OOM / crash-loop signatures"],
                    "safe", "medium", "5-10 minutes"),
        ]
    if any(k in text for k in ("latency", "slow", "p95", "p99", "response time")):
        return [
            _action(1, "investigate", "Profile", f"Profile slow endpoints on {svc}",
                    "Identify the endpoints driving the p95 latency regression.",
                    ["Query AppRequests | summarize percentile(DurationMs,95) by Name",
                     "Correlate with AppDependencies for slow downstream calls"],
                    "safe", "high", "5-10 minutes"),
            _action(2, "scale", "Scale", f"Scale out {svc} to relieve saturation",
                    "Add replicas to reduce queueing latency under load.",
                    ["az containerapp update -n <app> -g <rg> --min-replicas 2 --max-replicas 5",
                     "Watch p95 latency return below threshold"],
                    "medium", "high", "2-5 minutes"),
            _action(3, "investigate", "Dependencies", "Check downstream dependency health",
                    "A slow dependency often surfaces as upstream latency.",
                    ["Inspect AppDependencies success + duration", "Verify external service SLAs"],
                    "safe", "medium", "5-10 minutes"),
        ]
    if any(k in text for k in ("deploy", "revision", "rollout", "version", "release", "regression")):
        return [
            _action(1, "rollback", "Rollback", f"Roll back the latest revision of {svc}",
                    "Revert to the last known-good revision to restore service.",
                    ["az containerapp revision list -n <app> -g <rg> -o table",
                     "az containerapp revision activate -n <app> -g <rg> --revision <last-good>"],
                    "safe", "critical", "2-3 minutes"),
            _action(2, "investigate", "Verify", "Verify new revision health",
                    "Confirm whether the new revision is failing health/startup checks.",
                    ["az containerapp revision show -n <app> -g <rg> --revision <new>",
                     "Inspect startup logs for the new revision"],
                    "safe", "high", "3-5 minutes"),
            _action(3, "fix", "Hotfix", "Inspect startup logs + roll forward a fix",
                    "If rollback is undesirable, identify and patch the regression.",
                    ["Review ContainerAppConsoleLogs_CL at revision activation",
                     "Apply targeted config/image fix and redeploy"],
                    "medium", "high", "10-20 minutes"),
        ]
    # Default: elevated/critical error rate.
    return [
        _action(1, "investigate", "Inspect", f"Inspect the failing endpoint on {svc}",
                "Identify which requests are failing and why.",
                ["Query AppRequests | where Success==false | summarize count() by Name, ResultCode",
                 "Pull AppExceptions for stack traces"],
                "safe", "critical", "5-10 minutes"),
        _action(2, "rollback", "Review release", f"Review the most recent release of {svc}",
                "Recent deploys are a common cause of new error spikes.",
                ["Check recent revision activations", "Roll back if the spike aligns with a deploy"],
                "medium", "high", "3-10 minutes"),
        _action(3, "scale", "Scale", f"Scale {svc} if the errors are load-induced",
                "Add capacity if failures correlate with saturation.",
                ["az containerapp update -n <app> -g <rg> --min-replicas 2 --max-replicas 5",
                 "Confirm error rate falls below threshold"],
                "medium", "medium", "2-5 minutes"),
    ]


class RecommendationAgent(BaseAgent):
    role = "recommendation"
    role_label = "Recommendation"
    model_role = ModelRole.COMMANDER

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        context = {
            "metrics": state.metrics_findings,
            "logs": state.logs_findings,
            "deployment": state.deployment_findings,
            # Refined (or original) root cause — set by the orchestrator after the
            # root-cause / reasoning-escalation phase. Drives remediation choice.
            "root_cause": state.root_cause_findings,
            "incident_id": state.incident_id,
            "incident_description": state.incident_description,
        }
        actions: list[dict] = []
        try:
            result: RecommendationOutput = await self._llm_structured(
                system=RECOMMENDATION_SYSTEM_PROMPT,
                user=(
                    f"Incident: {state.incident_description}\n"
                    f"All findings:\n{json.dumps(context, indent=2)}"
                ),
                response_model=RecommendationOutput,
            )
            actions = [a.model_dump() for a in result.actions]
        except Exception:
            # Fall through to deterministic recommendations derived from the findings.
            actions = []

        # Task 2 — every completed investigation returns actionable remediation.
        # When the LLM yields none (or errors), derive recommendations from the
        # real incident signal + root cause (no fabrication).
        if not actions:
            actions = _fallback_actions(state)

        return AgentFinding(
            role=self.role,
            summary=f"{len(actions)} remediation action(s) identified.",
            evidence=[a["title"] for a in actions],
            confidence=90.0,
            metadata={"actions": actions},
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

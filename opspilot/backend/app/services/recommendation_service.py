"""Mock recommendation service — returns deterministic data matching the frontend fixtures."""
from __future__ import annotations

from app.models.recommendations import (
    ImpactLevel,
    RecommendationResponse,
    RecommendedAction,
    RiskLevel,
    RootCause,
)

_RECOMMENDATIONS: dict[str, RecommendationResponse] = {
    "INC-2024-0847": RecommendationResponse(
        incident_id="INC-2024-0847",
        root_cause=RootCause(
            incident_id="INC-2024-0847",
            title="ORM Connection Pool Regression in v2.4.1",
            description=(
                "Deployment v2.4.1 inadvertently reduced the SqlAlchemy connection pool size "
                "from 20 to 5 via an automated dependency update (commit a3f9c12). Under normal "
                "peak traffic, checkout-service requires up to 18 concurrent DB connections. "
                "With pool_size=5, requests queue until timeout, causing a cascading error rate "
                "spike that propagated to payment-gateway and cart-service."
            ),
            confidence=94.0,
            blast_radius=3,
            affected_users=12000,
            hourly_impact_usd=50400.0,
            evidence=[
                "v2.4.1 SQLALCHEMY_POOL_SIZE: 5 (v2.4.0: 20) — commit a3f9c12",
                "Error onset at 14:23 UTC, exactly 4 minutes after v2.4.1 deploy",
                "INC-2023-0412 resolved identically — 96% pattern match",
                "2,847 connection pool timeout errors in Log Analytics",
                "73% error rate correlates with pool exhaustion under peak load",
            ],
        ),
        actions=[
            RecommendedAction(
                id="action-847-1",
                incident_id="INC-2024-0847",
                priority=1,
                type="rollback",
                type_label="Rollback",
                title="Roll Back to v2.4.0 (Immediate Mitigation)",
                description=(
                    "Revert checkout-service to v2.4.0, which uses the correct pool_size=20 "
                    "configuration. This is the fastest path to service restoration and "
                    "carries minimal risk given v2.4.0 was stable for 14 days."
                ),
                steps=[
                    "Trigger rollback pipeline for checkout-service to tag v2.4.0",
                    "Monitor error rate — should drop below 1% within 2 minutes of deploy",
                    "Verify payment-gateway and cart-service recover automatically",
                    "Confirm DB connection pool metrics return to baseline",
                ],
                risk=RiskLevel.SAFE,
                risk_label="Safe",
                impact=ImpactLevel.HIGH,
                impact_label="High Impact",
                estimated_time="~5 min",
            ),
            RecommendedAction(
                id="action-847-2",
                incident_id="INC-2024-0847",
                priority=2,
                type="fix",
                type_label="Hotfix",
                title="Apply Hotfix: Restore pool_size=20 in v2.4.1",
                description=(
                    "Patch the ORM configuration in v2.4.1 to restore pool_size=20 and "
                    "deploy as v2.4.2. Enables v2.4.1 features while eliminating the "
                    "regression. Requires code review and regression test pass."
                ),
                steps=[
                    "Create branch hotfix/inc-2024-0847 from v2.4.1",
                    "Set SQLALCHEMY_POOL_SIZE = 20 in app/config/database.py",
                    "Run integration test suite (focus: DB connection pool under load)",
                    "Deploy v2.4.2 via standard pipeline with canary rollout",
                ],
                risk=RiskLevel.MEDIUM,
                risk_label="Medium Risk",
                impact=ImpactLevel.HIGH,
                impact_label="High Impact",
                estimated_time="~15 min",
            ),
            RecommendedAction(
                id="action-847-3",
                incident_id="INC-2024-0847",
                priority=3,
                type="infrastructure",
                type_label="Infrastructure",
                title="Scale Checkout Service Horizontally",
                description=(
                    "Deploy 4 additional checkout-service replicas to distribute connection "
                    "pool pressure across more instances. Buys time while rollback or hotfix "
                    "is prepared. Does not fix root cause but reduces blast radius."
                ),
                steps=[
                    "Scale checkout-service deployment from 3 to 7 replicas via kubectl",
                    "Confirm HPA metrics stabilise within 3 minutes",
                    "Monitor per-replica connection pool utilisation in Grafana",
                    "Maintain scaled state until root cause fix is deployed",
                ],
                risk=RiskLevel.MEDIUM,
                risk_label="Medium Risk",
                impact=ImpactLevel.LOW,
                impact_label="Low Impact",
                estimated_time="~30 min",
            ),
        ],
    )
}


async def get_recommendations(incident_id: str) -> RecommendationResponse | None:
    return _RECOMMENDATIONS.get(incident_id)

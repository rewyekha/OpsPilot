"""
Deployment tools — mock implementations for development.

Set USE_MOCK_TOOLS=False and implement real Azure DevOps / GitHub API calls
for production environments.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


@dataclass
class Deployment:
    id: str
    service: str
    version: str
    deployed_at: str
    deployer: str
    pipeline: str
    status: str
    commit_sha: str
    commit_message: str
    changed_files: list[str] = field(default_factory=list)
    config_changes: list[dict] = field(default_factory=list)


_BASE = datetime(2026, 6, 3, 12, 19, 0, tzinfo=timezone.utc)  # deploy time


def get_recent_deployments(service: str, hours_back: int = 24) -> list[Deployment]:
    """Return recent deployments for *service*."""
    if service == "checkout-service":
        return [
            Deployment(
                id="deploy-checkout-v241",
                service=service,
                version="v2.4.1",
                deployed_at=_BASE.isoformat(),
                deployer="azure-devops",
                pipeline="checkout-service-prod",
                status="success",
                commit_sha="a3f9c12",
                commit_message="chore: bump sqlalchemy dependency to 2.0.35 (automated)",
                changed_files=[
                    "requirements.txt",
                    "app/config/database.py",
                ],
                config_changes=[
                    {
                        "file": "app/config/database.py",
                        "key": "SQLALCHEMY_POOL_SIZE",
                        "old_value": "20",
                        "new_value": "5",
                        "reason": "Default reduced by sqlalchemy 2.0.35 migration guide",
                    }
                ],
            ),
            Deployment(
                id="deploy-checkout-v240",
                service=service,
                version="v2.4.0",
                deployed_at=(_BASE - timedelta(days=14)).isoformat(),
                deployer="azure-devops",
                pipeline="checkout-service-prod",
                status="success",
                commit_sha="b1d4e89",
                commit_message="feat: add order confirmation email retry logic",
                changed_files=["app/orders/email.py"],
                config_changes=[],
            ),
        ]
    return []


def get_config_diff(deployment_id: str) -> dict:
    """Return key configuration changes for a deployment."""
    if deployment_id == "deploy-checkout-v241":
        return {
            "deployment_id": deployment_id,
            "version": "v2.4.1",
            "critical_changes": [
                {
                    "key": "SQLALCHEMY_POOL_SIZE",
                    "before": 20,
                    "after": 5,
                    "impact": "critical",
                    "note": "Reduces max concurrent DB connections from 20 to 5."
                    " Peak load requires up to 18 connections.",
                }
            ],
        }
    return {"deployment_id": deployment_id, "critical_changes": []}

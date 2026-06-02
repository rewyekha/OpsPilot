"""
Deployment tools — interface to Azure DevOps, GitHub Actions, and change management.

In production (USE_MOCK_TOOLS=False):
  - Calls Azure DevOps REST API for pipeline runs and releases
  - Calls GitHub REST API for Actions workflow runs and commit diffs
  - Calls Azure AI Search for runbook retrieval

In development / demo (USE_MOCK_TOOLS=True):
  - Returns pre-built fixture data from fixtures/incidents/checkout_failure.json

Tool signatures:
  get_recent_deployments(service: str, hours_back: int) -> ToolResult[list[Deployment]]
  get_git_diff(deployment_id: str) -> ToolResult[GitDiff]
  get_change_timeline(service: str, start: datetime, end: datetime) -> ToolResult
  retrieve_runbook(service: str, symptom: str) -> ToolResult[Runbook]
"""

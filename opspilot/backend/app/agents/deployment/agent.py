"""
Deployment Agent — specialist node for change correlation.

Responsibilities:
  - Retrieve all deployments to affected services in the past 24 hours
  - For each deployment, retrieve the associated git diff and change description
  - Correlate deployment timestamps with the incident start time
  - Identify the most recent deployment before the incident window as primary suspect
  - Retrieve relevant runbooks for the affected service from Azure AI Search
  - Return a structured DeploymentFindings object

Model: GPT-4o-mini (specialist_model_deployment)
  Receives deployment metadata and git diff summaries.
  Produces structured DeploymentFindings via enforced schema output.

Tools available (see tools/deployment_tools.py):
  - get_recent_deployments(service, hours_back) → list[Deployment]
  - get_git_diff(deployment_id) → GitDiff
  - get_change_timeline(service, start, end) → list[ChangeEvent]
  - retrieve_runbook(service, symptom) → Runbook   [via Azure AI Search]

When USE_MOCK_TOOLS=True: tools return data from fixtures/incidents/*.json
"""

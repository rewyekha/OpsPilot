"""
Infrastructure tools — interface to Kubernetes, Azure Resource Manager, and VM events.

In production (USE_MOCK_TOOLS=False):
  - Calls Kubernetes API server for pod events, restarts, OOM kills
  - Calls Azure Resource Manager for resource health events
  - Calls Azure Service Health API for platform incidents

In development / demo (USE_MOCK_TOOLS=True):
  - Returns pre-built fixture data from fixtures/incidents/

Tool signatures:
  get_k8s_events(namespace: str, service: str, start: datetime, end: datetime) -> ToolResult
  get_pod_status(namespace: str, service: str) -> ToolResult[list[PodStatus]]
  get_resource_utilization(service: str, window_minutes: int) -> ToolResult
  get_azure_service_health(subscription_id: str, region: str) -> ToolResult
"""

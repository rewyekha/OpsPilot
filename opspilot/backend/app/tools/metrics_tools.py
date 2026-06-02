"""
Metrics tools — interface to Prometheus and Azure Monitor.

In production (USE_MOCK_TOOLS=False):
  - Calls real Prometheus HTTP API
  - Calls real Azure Monitor REST API via azure-monitor-query SDK

In development / demo (USE_MOCK_TOOLS=True):
  - Returns pre-built fixture data from fixtures/metrics/prometheus_responses.json
  - Fixture data is crafted to tell a realistic incident story

All tools return a ToolResult wrapper with:
  - data: the actual metric data
  - confidence: how complete/reliable the data is (0.0–1.0)
  - source: data source identifier for evidence citation
  - timestamp: when the data was fetched
  - latency_ms: tool call latency for observability

Tool signatures:
  query_prometheus(service: str, metric: str, start: datetime, end: datetime, step: str) -> ToolResult
  query_azure_monitor(resource_id: str, metric_name: str, timespan: timedelta) -> ToolResult
  detect_anomaly(series: list[DataPoint]) -> AnomalyResult
"""

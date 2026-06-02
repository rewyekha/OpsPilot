"""
Metrics Agent — specialist node for time-series analysis.

Responsibilities:
  - Query Prometheus (or Azure Monitor) for the affected services over the incident window
  - Detect anomalous deviations in key metrics: latency (p50/p95/p99), error rate,
    throughput (RPS), saturation (CPU, memory, DB connections)
  - Identify the exact timestamp of first metric deviation
  - Correlate metrics across dependent services to trace cascading failures
  - Return a structured MetricsFindings object

Model: GPT-4o-mini (specialist_model_deployment)
  Receives raw metric data as structured JSON.
  Produces structured MetricsFindings via enforced schema output.

Tools available (see tools/metrics_tools.py):
  - query_prometheus(service, metric, start, end, step)
  - query_azure_monitor(resource_id, metric_name, timespan)
  - detect_anomaly(time_series_data) → AnomalyResult

When USE_MOCK_TOOLS=True: tools return data from fixtures/metrics/prometheus_responses.json
"""

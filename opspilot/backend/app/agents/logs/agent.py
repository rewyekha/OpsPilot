"""
Logs Agent — specialist node for log analysis.

Responsibilities:
  - Query Azure Log Analytics (KQL) or OpenSearch for the affected services
  - Extract error patterns, exception types, and stack traces
  - Identify first occurrence time of each error class
  - Measure error frequency and rate trends
  - Find correlating log events in upstream and downstream services
  - Return a structured LogsFindings object

Model: GPT-4o-mini (specialist_model_deployment)
  Receives log excerpts as structured JSON.
  Produces structured LogsFindings via enforced schema output.

Tools available (see tools/logs_tools.py):
  - query_log_analytics(workspace_id, kql_query, timespan)
  - search_errors(service, severity, start, end) → list[LogEntry]
  - extract_stack_traces(log_entries) → list[StackTrace]
  - get_error_frequency(service, error_type, window_minutes) → FrequencyResult

When USE_MOCK_TOOLS=True: tools return data from fixtures/logs/log_analytics_responses.json
"""

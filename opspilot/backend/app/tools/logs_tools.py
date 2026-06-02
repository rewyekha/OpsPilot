"""
Logs tools — interface to Azure Log Analytics and log aggregation systems.

In production (USE_MOCK_TOOLS=False):
  - Calls Azure Log Analytics via azure-monitor-query SDK (KQL)
  - KQL queries are parameterized; never constructed from raw user input

In development / demo (USE_MOCK_TOOLS=True):
  - Returns pre-built fixture data from fixtures/logs/log_analytics_responses.json

Tool signatures:
  query_log_analytics(workspace_id: str, kql_query: str, timespan: timedelta) -> ToolResult
  search_errors(service: str, severity: str, start: datetime, end: datetime) -> ToolResult
  extract_stack_traces(log_entries: list[LogEntry]) -> list[StackTrace]
  get_error_frequency(service: str, error_type: str, window_minutes: int) -> ToolResult

Security note:
  KQL queries must never be constructed from raw user input.
  All queries use parameterized templates from the queries/ directory.
"""

"""
Unit tests — Agent nodes.

Tests each LangGraph node function in isolation.
All LLM calls are mocked via pytest-mock to avoid real API calls in CI.
All tool calls return fixture data.

Test coverage targets:
  - commander_intake: correctly classifies severity and extracts service names
  - metrics_agent: correctly processes fixture metric data into MetricsFindings
  - logs_agent: correctly extracts error patterns from fixture log data
  - deployment_agent: correctly identifies the culprit deployment
  - time_machine_agent: correctly merges all findings into a timeline
  - commander_synthesize: correctly produces a RootCauseAssessment from findings
  - confidence scores are within valid range (0.0–1.0)
  - agent_status transitions follow correct lifecycle
"""

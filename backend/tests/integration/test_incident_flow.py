"""
Integration tests — full incident investigation flow.

Tests the complete LangGraph graph execution from incident creation to final report.
All Azure SDK calls are mocked; LLM calls use mocked responses from fixtures.

Scenarios tested:
  1. checkout_failure: P1 incident → expects root cause related to DB connection pool
  2. payment_timeout: P2 incident → expects root cause related to upstream timeout
  3. db_connection_pool: isolated DB incident → expects focused root cause

Each scenario asserts:
  - All 5 agents reach COMPLETE status
  - state.root_cause is not None
  - state.root_cause.primary.confidence >= 0.0
  - len(state.recommendations) >= 1
  - state.executive_summary is not None
  - state.timeline has at least 3 events
"""

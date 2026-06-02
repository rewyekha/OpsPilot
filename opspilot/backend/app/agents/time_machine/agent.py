"""
Time Machine Agent — specialist node for causal timeline construction.

This agent is the most architecturally unique component of OpsPilot.

Unlike the other agents which query a single data source, the Time Machine Agent
reads the *outputs* of all other completed agents and synthesizes a unified,
chronologically ordered event timeline with causal annotations.

Responsibilities:
  - Wait for MetricsAgent, LogsAgent, and DeploymentAgent to complete
  - Read all three findings from OpsPilotState
  - Merge all timestamped events into a single chronological sequence
  - Annotate causal relationships between events (e.g., deployment → metric spike → errors)
  - Identify the "moment of failure" — the earliest event that triggered the cascade
  - Identify the "blast propagation path" — how failure spread across services
  - Return a list[TimelineEvent] written to state.timeline

Model: GPT-4o (commander_model_deployment)
  Requires full context to reason across all three agent findings simultaneously.
  This is the only specialist agent that uses the higher-capability model.

This agent runs AFTER the other three agents complete (fan-in dependency in graph).
It is the final specialist before Commander synthesis.

Tools: None — operates purely on state data already collected.
"""

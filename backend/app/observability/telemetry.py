"""
OpenTelemetry configuration and custom instrumentation.

Sets up:
  - TracerProvider with Azure Application Insights exporter
  - MeterProvider with Prometheus exporter (scraped by Grafana)
  - Custom spans for LangGraph node entry/exit
  - Custom metrics:
      opspilot.investigation.duration_seconds (histogram)
      opspilot.agent.execution_duration_seconds (histogram, labeled by agent_name)
      opspilot.llm.tokens_total (counter, labeled by model, agent_name)
      opspilot.investigation.confidence_score (gauge)
      opspilot.tool.call_duration_seconds (histogram, labeled by tool_name)
"""

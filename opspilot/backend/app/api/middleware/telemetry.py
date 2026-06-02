"""
OpenTelemetry middleware.

Instruments every HTTP request with:
- trace_id propagated to all downstream agent calls
- span attributes: incident_id, agent_name, model_deployment
- Azure Application Insights exporter
- Prometheus metrics exporter (request count, latency histograms)

All LangGraph agent nodes inherit the active span context via context propagation.
"""

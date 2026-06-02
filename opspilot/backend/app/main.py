"""
OpsPilot Backend
================
FastAPI application entry point.

Registers:
- API routers (incidents, agents, stream)
- CORS middleware
- OpenTelemetry instrumentation
- Azure Application Insights exporter
- Startup / shutdown lifecycle hooks
"""

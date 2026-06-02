"""
SSE event stream service.

Manages an in-process event bus that bridges LangGraph graph callbacks
to the HTTP SSE endpoints consumed by the frontend.

Architecture:
  LangGraph node callback
      └─► EventStreamService.emit(SSEEvent)
              └─► asyncio.Queue per incident_id
                      └─► /api/incidents/{id}/stream SSE endpoint
                              └─► Frontend AgentActivityStream component

One queue per active investigation. Queues are cleaned up when investigation completes.
Redis pub/sub used in multi-replica deployments (ACA scale > 1).
"""

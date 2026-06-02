"""
Server-Sent Events (SSE) stream router.

Endpoint:
  GET /api/incidents/{id}/stream

Emits a real-time SSE stream of agent activity events for a given incident.
The frontend Agent Activity Stream panel subscribes to this endpoint.

Event types emitted (see models/events.py):
  - agent.started          — agent node entered in LangGraph graph
  - agent.tool_called      — agent invoked a tool
  - agent.tool_result      — tool returned a result
  - agent.finding          — agent emitted a structured finding
  - agent.completed        — agent node exited successfully
  - timeline.event_added   — Time Machine Agent added a timeline entry
  - root_cause.updated     — Commander updated root cause hypothesis scores
  - recommendations.ready  — Commander produced final recommendations
  - investigation.complete — all agents complete, full report available
"""

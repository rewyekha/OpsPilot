// Domain types — SSE Event stream
// Mirrors backend app/models/events.py

export type EventType =
  | 'agent.started'
  | 'agent.tool_called'
  | 'agent.tool_result'
  | 'agent.finding'
  | 'agent.completed'
  | 'agent.failed'
  | 'timeline.event_added'
  | 'root_cause.updated'
  | 'recommendations.ready'
  | 'investigation.complete'

export interface SSEEvent<T = Record<string, unknown>> {
  event_type: EventType
  incident_id: string
  timestamp: string
  agent_name: string | null
  payload: T
}

export interface AgentStartedPayload {
  agent_name: string
  model: string
}

export interface AgentFindingPayload {
  agent_name: string
  summary: string
  confidence: number
  evidence_count: number
}

export interface RootCauseUpdatedPayload {
  primary_hypothesis: string
  confidence: number
  alternative_count: number
}

export interface InvestigationCompletePayload {
  incident_id: string
  root_cause_confidence: number
  recommendation_count: number
  duration_seconds: number
}

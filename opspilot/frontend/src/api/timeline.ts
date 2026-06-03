import { apiFetch } from './client'

export interface ApiTimelineEvent {
  id: string
  incident_id: string
  type: string
  type_label: string
  title: string
  description: string
  timestamp: string
  relative_time: string
  confidence: number
  is_key_event: boolean
  agent_role: string | null
  metadata: Record<string, string>
}

export interface ApiTimelineResponse {
  incident_id: string
  events: ApiTimelineEvent[]
}

export const timelineApi = {
  get: (incidentId: string): Promise<ApiTimelineResponse> =>
    apiFetch<ApiTimelineResponse>(`/api/timeline/${encodeURIComponent(incidentId)}`),
}

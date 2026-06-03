import { apiFetch } from './client'

export interface ApiAgentTask {
  id: string
  incident_id: string
  role: string
  role_label: string
  status: string
  confidence: number
  finding: string
  evidence: string[]
  tools_called: string[]
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
}

export interface ApiAgentActivityResponse {
  incident_id: string
  total_dispatched: number
  completed: number
  running: number
  waiting: number
  agents: ApiAgentTask[]
}

export const agentApi = {
  getActivity: (incidentId: string): Promise<ApiAgentActivityResponse> =>
    apiFetch<ApiAgentActivityResponse>(
      `/api/agents/activity?incident_id=${encodeURIComponent(incidentId)}`,
    ),
}
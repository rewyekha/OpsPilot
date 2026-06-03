import { apiFetch } from './client'

export interface ApiIncidentRecord {
  id: string
  description: string
  status: string
  severity: string
  affected_services: string[]
  reporter: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  langgraph_run_id: string | null
  error_rate_pct: number | null
}

export const incidentApi = {
  getActive: (): Promise<ApiIncidentRecord[]> =>
    apiFetch<ApiIncidentRecord[]>('/api/incidents/active'),

  getById: (id: string): Promise<ApiIncidentRecord> =>
    apiFetch<ApiIncidentRecord>(`/api/incidents/${encodeURIComponent(id)}`),
}

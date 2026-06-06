import { apiPost } from './client'

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

export interface CreateIncidentBody {
  description: string
  affected_services: string[]
  reporter?: string
}

export const incidentsApi = {
  /**
   * Create an incident and start a REAL backend investigation (orchestrator runs
   * over live telemetry). Returns the created record (with a real backend id).
   * This is an explicit user-initiated investigation — an allowed trigger.
   */
  create: (body: CreateIncidentBody): Promise<ApiIncidentRecord> =>
    apiPost<ApiIncidentRecord>('/api/incidents/', {
      description: body.description,
      affected_services: body.affected_services,
      reporter: body.reporter ?? 'operator',
    }),
}

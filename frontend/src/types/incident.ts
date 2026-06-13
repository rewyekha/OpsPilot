// Domain types — Incident
// Mirrors backend app/models/incident.py

export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3'

export type IncidentStatus =
  | 'open'
  | 'investigating'
  | 'mitigated'
  | 'resolved'
  | 'post_mortem'

export interface CreateIncidentRequest {
  description: string
  affected_services: string[]
  reported_severity: IncidentSeverity
}

export interface IncidentRecord {
  id: string
  description: string
  status: IncidentStatus
  severity: IncidentSeverity
  affected_services: string[]
  reporter: string
  created_at: string        // ISO 8601
  updated_at: string
  resolved_at: string | null
  langgraph_run_id: string | null
}

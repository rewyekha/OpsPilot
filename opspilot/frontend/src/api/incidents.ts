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

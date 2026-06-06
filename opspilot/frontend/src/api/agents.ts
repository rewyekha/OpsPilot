/** One agent's execution as carried in an export snapshot (utils/incidentExport). */
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

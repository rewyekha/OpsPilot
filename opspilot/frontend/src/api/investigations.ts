import { apiPost } from './client'

export interface InvestigateResponse {
  incident_id: string
  status: 'started' | 'already_running'
  mode: 'live' | 'mock'
}

export interface DeepReasoningFinding {
  role: string
  summary: string
  evidence: string[]
  confidence: number
}

export interface DeepReasoningRequest {
  incident_description: string
  findings: DeepReasoningFinding[]
  root_cause?: DeepReasoningFinding | null
}

export interface DeepReasoningResult {
  incident_id: string
  title: string
  description: string
  confidence: number
  blast_radius: number
  affected_users: number
  hourly_impact_usd: number
  evidence: string[]
  reasoning_trace: string
  mode: 'live' | 'mock'
}

export const investigationsApi = {
  /** Re-run the full agent investigation (real orchestrator execution). */
  rerun: (incidentId: string): Promise<InvestigateResponse> =>
    apiPost<InvestigateResponse>(`/api/incidents/${encodeURIComponent(incidentId)}/investigate`),

  /** Run deep reasoning (o4-mini) over the current findings; returns refined RCA. */
  deepReasoning: (incidentId: string, body: DeepReasoningRequest): Promise<DeepReasoningResult> =>
    apiPost<DeepReasoningResult>(
      `/api/incidents/${encodeURIComponent(incidentId)}/deep-reasoning`,
      body,
    ),
}

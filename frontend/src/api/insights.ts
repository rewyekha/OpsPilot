import { apiFetch } from './client'

/** One agent's real execution within an investigation (mirrors backend). */
export interface AgentExecution {
  role: string
  role_label: string
  status: string
  confidence: number
  duration_seconds: number
  finding: string
  evidence: string[]
  started_at: string
  completed_at: string
}

export interface InvestigationRootCause {
  title: string
  description: string
  confidence: number
  blast_radius: number
  affected_users: number
  hourly_impact_usd: number
  evidence: string[]
  source?: string
}

/** A remediation action captured from the RecommendationAgent (stored on the record). */
export interface StoredAction {
  id: string
  type: string
  type_label: string
  title: string
  description: string
  steps: string[]
  risk: string
  risk_label: string
  impact: string
  impact_label: string
  estimated_time: string
  priority: number
}

/** A persisted, completed investigation — the single source of truth. */
export interface InvestigationRecord {
  id: string
  incident_id: string
  description: string
  started_at: string
  completed_at: string
  duration_seconds: number
  status: string
  mode: string
  severity: string
  combined_confidence: number
  escalated: boolean
  root_cause: InvestigationRootCause
  recommendations: StoredAction[]
  agents: AgentExecution[]
}

export interface VolumePoint { date: string; label: string; count: number }

export interface AnalyticsData {
  has_data: boolean
  total_investigations: number
  mttr_seconds?: number
  mean_duration_seconds?: number
  confidence_distribution?: Record<string, number>
  root_cause_categories?: Record<string, number>
  investigation_volume?: VolumePoint[]
  agent_success_rate?: Record<string, number>
  overall_agent_success_rate?: number
  reasoning_escalation_rate?: number
}

export interface AgentStat {
  role: string
  role_label: string
  execution_count: number
  avg_duration_seconds: number
  avg_confidence: number
  last_execution: string | null
  success_rate: number
}

export const insightsApi = {
  investigations: (incidentId?: string): Promise<InvestigationRecord[]> =>
    apiFetch<InvestigationRecord[]>(`/api/investigations${incidentId ? `?incident_id=${encodeURIComponent(incidentId)}` : ''}`),
  latest: (incidentId?: string): Promise<InvestigationRecord | null> =>
    apiFetch<InvestigationRecord | null>(`/api/investigations/latest${incidentId ? `?incident_id=${encodeURIComponent(incidentId)}` : ''}`),
  analytics: (): Promise<AnalyticsData> => apiFetch<AnalyticsData>('/api/analytics'),
  agentStats: (): Promise<AgentStat[]> => apiFetch<AgentStat[]>('/api/agents/stats'),
}

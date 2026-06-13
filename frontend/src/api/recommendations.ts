export interface ApiRootCause {
  incident_id: string
  title: string
  description: string
  confidence: number
  blast_radius: number
  affected_users: number
  hourly_impact_usd: number
  evidence: string[]
}

export interface ApiRecommendedAction {
  id: string
  incident_id: string
  priority: number
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
}

export interface ApiRecommendationResponse {
  incident_id: string
  root_cause: ApiRootCause
  actions: ApiRecommendedAction[]
}

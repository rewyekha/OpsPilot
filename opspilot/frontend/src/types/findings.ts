// Domain types — Investigation findings
// Mirrors backend app/agents/state.py output fields

export interface TimelineEvent {
  timestamp: string
  source: 'metrics' | 'logs' | 'deployment' | 'infra' | 'commander'
  description: string
  severity: 'info' | 'warning' | 'critical'
  evidence_refs: string[]
}

export interface RootCauseHypothesis {
  hypothesis: string
  confidence: number          // 0.0–1.0
  supporting_evidence: string[]
  contradicting_evidence: string[]
}

export interface RootCauseAssessment {
  primary: RootCauseHypothesis
  alternatives: RootCauseHypothesis[]
  reasoning_trace: string     // full chain-of-thought from Commander
}

export interface BlastRadiusAssessment {
  affected_services: string[]
  affected_users_estimate: number
  affected_regions: string[]
  downstream_dependencies: string[]
  business_impact_usd_per_hour: number
}

export interface Recommendation {
  priority: number
  timeframe: 'immediate' | 'short-term' | 'long-term'
  action: string
  rationale: string
  confidence: number
}

export interface InvestigationReport {
  incident_id: string
  timeline: TimelineEvent[]
  root_cause: RootCauseAssessment | null
  blast_radius: BlastRadiusAssessment | null
  recommendations: Recommendation[]
  executive_summary: string | null
}

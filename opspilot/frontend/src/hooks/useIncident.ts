import { useState, useEffect } from 'react'
import type { ApiIncidentRecord } from '../api/incidents'
import type { ApiRecommendationResponse } from '../api/recommendations'
import { insightsApi, type InvestigationRecord } from '../api/insights'

export interface IncidentWithRec {
  incident: ApiIncidentRecord
  recommendations: ApiRecommendationResponse | null
}

export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Build the incident + recommendations view entirely from a persisted, real
 *  investigation record — no static incident/recommendation seeds. */
function fromRecord(rec: InvestigationRecord): IncidentWithRec {
  const incident: ApiIncidentRecord = {
    id: rec.incident_id,
    description: rec.description,
    status: 'investigating',
    severity: rec.severity, // real (commander LLM) or '' → empty state; never a default
    affected_services: [],
    reporter: 'orchestrator',
    created_at: rec.started_at,
    updated_at: rec.completed_at,
    resolved_at: null,
    langgraph_run_id: rec.id,
    error_rate_pct: null,
  }
  const recommendations: ApiRecommendationResponse = {
    incident_id: rec.incident_id,
    root_cause: {
      incident_id: rec.incident_id,
      title: rec.root_cause.title,
      description: rec.root_cause.description,
      confidence: rec.root_cause.confidence,
      blast_radius: rec.root_cause.blast_radius,
      affected_users: rec.root_cause.affected_users,
      hourly_impact_usd: rec.root_cause.hourly_impact_usd,
      evidence: rec.root_cause.evidence,
    },
    actions: rec.recommendations.map((a) => ({ ...a, incident_id: rec.incident_id })),
  }
  return { incident, recommendations }
}

/**
 * Latest real investigation for the active incident, adapted to the incident +
 * recommendations shape. Returns null (→ empty state) until an investigation has
 * run. Re-fetches on `opspilot:refresh`.
 */
export function useActiveIncidentWithRecommendations(): FetchState<IncidentWithRec> {
  const [state, setState] = useState<FetchState<IncidentWithRec>>({ data: null, loading: true, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const bump = () => setNonce((n) => n + 1)
    window.addEventListener('opspilot:refresh', bump)
    window.addEventListener('opspilot:poll', bump)
    return () => {
      window.removeEventListener('opspilot:refresh', bump)
      window.removeEventListener('opspilot:poll', bump)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    insightsApi
      .latest()
      .then((rec) => {
        if (cancelled) return
        // No record is the EMPTY state (no active incident), NOT an error.
        setState({ data: rec ? fromRecord(rec) : null, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // Keep existing data on a background-refetch error (no blanking).
        setState((s) => (s.data === null
          ? { data: null, loading: false, error: err instanceof Error ? err.message : 'Failed to load incident' }
          : { ...s, loading: false }))
      })
    return () => { cancelled = true }
  }, [nonce])

  return state
}

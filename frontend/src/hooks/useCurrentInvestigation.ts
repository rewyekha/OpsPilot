/**
 * useCurrentInvestigation — the investigation the dashboard should display.
 *
 * The dashboard is execution-driven: it always shows a real persisted
 * investigation, never seeded data. But WHICH investigation depends on state:
 *   • An incident is ACTIVE  → show THAT incident's own latest investigation, so
 *     executing a scenario surfaces the findings for the incident it raised
 *     (not whatever happened to be investigated most recently overall).
 *   • Nothing is active      → fall back to the most recent investigation across
 *     all incidents (the idle / historical view).
 *
 * Returns the record (null while a run is still in flight) and the active
 * incident id so callers can distinguish "live" from "historical".
 */
import { useActiveIncidents } from './useActiveIncidents'
import { useLatestInvestigation } from './useInsights'
import type { InvestigationRecord } from '../api/insights'

export interface CurrentInvestigation {
  record: InvestigationRecord | null
  activeIncidentId: string | null
  loading: boolean
}

export function useCurrentInvestigation(): CurrentInvestigation {
  const active = useActiveIncidents()
  const activeId = active.data?.[0]?.id ?? ''
  const scoped = useLatestInvestigation(activeId || undefined)
  const global = useLatestInvestigation()
  const source = activeId ? scoped : global
  return {
    record: source.data ?? null,
    activeIncidentId: activeId || null,
    loading: source.loading,
  }
}

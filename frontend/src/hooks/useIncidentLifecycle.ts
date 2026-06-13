/**
 * useIncidentLifecycle — the TRUE current lifecycle status of an incident.
 *
 * Precedence:
 *   1. Operator action THIS session (investigating → mitigating → … → closed)
 *      always wins — the human just acted on it.
 *   2. Otherwise it is derived from whether the incident is ACTIVE right now,
 *      per /api/incidents/active (the authoritative live-state source): an
 *      incident in that list is 'investigating'; a persisted investigation that
 *      is NO LONGER active is 'resolved'.
 *
 * This replaces the old `incidentStatus()` default of 'investigating', which
 * made every completed/historical investigation render as a perpetual live P0
 * after a page reload (no client-side session record exists then). An empty id
 * (nothing to show) resolves to 'resolved'.
 */
import { useSession } from '../store/SessionContext'
import { useActiveIncidents } from './useActiveIncidents'
import type { LifecycleKey } from '../theme/tokens'

export function useIncidentLifecycle(incidentId: string | null | undefined): LifecycleKey {
  const { incidents } = useSession()
  const active = useActiveIncidents()
  const id = incidentId ?? ''
  const sessionStatus = id ? incidents[id]?.status : undefined
  if (sessionStatus) return sessionStatus
  const isActive = !!id && (active.data ?? []).some((i) => i.id === id)
  return isActive ? 'investigating' : 'resolved'
}

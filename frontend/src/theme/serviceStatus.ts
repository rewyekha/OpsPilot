/**
 * Shared derived service status (Task 3) — the single source of truth used by both
 * the Monitored Services card and the Service detail blade so they never disagree.
 * Never returns UNKNOWN: an idle-but-discovered service reads HEALTHY (telemetry
 * present, no incident); incident/telemetry state escalates it.
 */
import { asHealth } from './tokens'
import type { ApiServiceHealth } from '../api/services'

export type DisplayStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'INVESTIGATING'

export const STATUS_STYLE: Record<DisplayStatus, { color: string; bg: string; border: string; text: string }> = {
  HEALTHY:       { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  text: '#4ade80' },
  WARNING:       { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#fbbf24' },
  CRITICAL:      { color: '#dc2626', bg: 'rgba(220,38,38,0.14)',  border: 'rgba(220,38,38,0.4)',   text: '#f87171' },
  INVESTIGATING: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', text: '#60a5fa' },
}

export function deriveServiceStatus(svc: ApiServiceHealth, incident?: { severity?: string }): DisplayStatus {
  const h = asHealth(svc.status) // healthy | degraded | unhealthy | unknown
  const isP1 = !!incident && (incident.severity === 'P1' || incident.severity === 'P0')
  if (h === 'unhealthy' || isP1) return 'CRITICAL'
  if (incident) return 'INVESTIGATING'          // active incident, not yet P1
  if (h === 'degraded') return 'WARNING'
  return 'HEALTHY'                               // healthy OR unknown — telemetry present, no incident
}

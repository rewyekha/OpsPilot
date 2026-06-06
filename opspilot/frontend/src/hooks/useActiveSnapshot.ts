/**
 * useActiveSnapshot — assembles a SnapshotInput for the active incident from the
 * latest persisted investigation record (single source of truth). Used by the
 * command bar, the Settings → Export section, the incident actions menu, and the
 * InvestigationBlade — so exports and the blade's findings/evidence/recommendations
 * are all real execution output, never static.
 */
import { useCallback } from 'react'
import { useSession } from '../store/SessionContext'
import { useLatestInvestigation } from './useInsights'
import { ACTIVE_INCIDENT_ID } from '../utils/constants'
import { type SnapshotInput } from '../utils/incidentExport'

export interface ActiveSnapshot {
  /** True once a real investigation has completed for this incident. */
  ready: boolean
  buildInput: () => SnapshotInput
}

export function useActiveSnapshot(): ActiveSnapshot {
  const { timelineEvents, jobs, incidentStatus } = useSession()
  const { data: record } = useLatestInvestigation(ACTIVE_INCIDENT_ID)

  const ready = Boolean(record)

  const buildInput = useCallback(
    (): SnapshotInput => ({
      incidentId: ACTIVE_INCIDENT_ID,
      status: incidentStatus(ACTIVE_INCIDENT_ID),
      incident: record
        ? {
            id: record.incident_id,
            description: record.description,
            status: 'investigating',
            severity: record.severity || 'P2',
            affected_services: [],
            reporter: 'orchestrator',
            created_at: record.started_at,
            updated_at: record.completed_at,
            resolved_at: null,
            langgraph_run_id: record.id,
            error_rate_pct: null,
          }
        : null,
      rootCause: record
        ? {
            incident_id: record.incident_id,
            title: record.root_cause.title,
            description: record.root_cause.description,
            confidence: record.root_cause.confidence,
            blast_radius: record.root_cause.blast_radius,
            affected_users: record.root_cause.affected_users,
            hourly_impact_usd: record.root_cause.hourly_impact_usd,
            evidence: record.root_cause.evidence,
          }
        : null,
      actions: record ? record.recommendations.map((a) => ({ ...a, incident_id: record.incident_id })) : [],
      agents: record
        ? record.agents.map((a) => ({
            id: a.role,
            incident_id: record.incident_id,
            role: a.role,
            role_label: a.role_label,
            status: a.status,
            confidence: a.confidence,
            finding: a.finding,
            evidence: a.evidence,
            tools_called: [],
            started_at: a.started_at,
            completed_at: a.completed_at,
            duration_seconds: a.duration_seconds,
          }))
        : [],
      jobs: Object.values(jobs),
      sessionEvents: timelineEvents,
      generatedAt: new Date().toISOString(),
    }),
    [record, incidentStatus, jobs, timelineEvents],
  )

  return { ready, buildInput }
}

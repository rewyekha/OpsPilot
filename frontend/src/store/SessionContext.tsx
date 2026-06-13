/**
 * SessionContext — client-only "session overlay" state.
 *
 * The backend data (incidents, recommendations, agents, timeline) is read-only
 * from the app's perspective. This store holds the ephemeral, user-initiated
 * state that layers on top of it without touching the backend:
 *
 *   - actionJobs:      remediation execution jobs + their live status
 *   - timelineEvents:  operator-action breadcrumbs (e.g. "Investigation created"
 *                      is emitted only after a REAL backend investigation starts)
 *   - incidents:       per-incident lifecycle records (status + timestamps + meta)
 *
 * Incident lifecycle: investigating → mitigating → monitoring → resolved → closed.
 *   - submitting a remediation moves the incident to "mitigating"
 *   - a successful remediation moves it to "monitoring"
 *   - the operator marks "resolved", then "closed"
 * Every transition records a timeline event and raises a toast.
 *
 * Execution is fully mocked: submitActionJob() drives a status state machine via
 * timers. No real deployment is performed.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ApiRecommendedAction } from '../api/recommendations'
import { incidentsApi } from '../api/incidents'
import { useNotify } from './NotificationContext'
import { LIFECYCLE_LABELS, type LifecycleKey } from '../theme/tokens'

// ── Action execution ──────────────────────────────────────────────────────────

export type JobStatus = 'submitting' | 'running' | 'succeeded' | 'failed'

export interface ActionJob {
  jobId: string
  actionId: string
  actionTitle: string
  actionType: string
  status: JobStatus
  submittedAt: string
  completedAt: string | null
}

// ── Synthetic timeline events ──────────────────────────────────────────────────

export type SessionEventKind =
  | 'action_submitted'
  | 'action_succeeded'
  | 'action_failed'
  | 'investigation_created'
  | 'state_transition'

export interface SessionTimelineEvent {
  id: string
  incidentId: string
  timestamp: string // ISO
  kind: SessionEventKind
  title: string
  description: string
  source: string
  confidence: number
}

// ── Incident lifecycle records ──────────────────────────────────────────────────

export type IncidentLifecycle = LifecycleKey

export interface IncidentSessionRecord {
  id: string
  status: IncidentLifecycle
  title: string | null
  rootCause: string | null
  impactUsd: number | null
  blastRadius: number | null
  startedAt: string | null // ISO — for duration (seeded from API created_at)
  resolvedAt: string | null
  closedAt: string | null
}

/** Meta the panels seed onto a record for display in History etc. */
export type IncidentMeta = Partial<
  Pick<IncidentSessionRecord, 'title' | 'rootCause' | 'impactUsd' | 'blastRadius' | 'startedAt'>
>

const blankRecord = (id: string): IncidentSessionRecord => ({
  id,
  status: 'investigating',
  title: null,
  rootCause: null,
  impactUsd: null,
  blastRadius: null,
  startedAt: null,
  resolvedAt: null,
  closedAt: null,
})

interface SessionContextValue {
  jobs: Record<string, ActionJob>
  timelineEvents: SessionTimelineEvent[]
  incidents: Record<string, IncidentSessionRecord>
  closedIncidents: IncidentSessionRecord[]
  submitActionJob: (action: ApiRecommendedAction) => void
  createInvestigation: (input: {
    description: string
    affectedServices: string[]
  }) => Promise<void>
  registerIncident: (id: string, meta: IncidentMeta) => void
  incidentStatus: (id: string) => IncidentLifecycle
  incidentRecord: (id: string) => IncidentSessionRecord | undefined
  markResolved: (id: string) => void
  closeIncident: (id: string) => void
  reopenIncident: (id: string) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

const RUNNING_AFTER_MS = 900
const SUCCEEDED_AFTER_MS = 2800

// Statuses from which an action may still drive the incident forward.
const ACTIONABLE = new Set<IncidentLifecycle>(['investigating', 'mitigating', 'monitoring'])

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notify = useNotify()
  const [jobs, setJobs] = useState<Record<string, ActionJob>>({})
  const [timelineEvents, setTimelineEvents] = useState<SessionTimelineEvent[]>([])
  const [incidents, setIncidents] = useState<Record<string, IncidentSessionRecord>>({})
  const seq = useRef(0)

  const nextId = useCallback((prefix: string) => {
    seq.current += 1
    return `${prefix}-${Date.now().toString(36)}-${seq.current}`
  }, [])

  const appendEvent = useCallback(
    (e: Omit<SessionTimelineEvent, 'id' | 'timestamp'>) => {
      setTimelineEvents((prev) => [
        ...prev,
        { ...e, id: nextId('evt'), timestamp: new Date().toISOString() },
      ])
    },
    [nextId],
  )

  // Ref mirror so long-lived setTimeout closures read the latest statuses.
  const incidentStatusRef = useRef<(id: string) => IncidentLifecycle>(() => 'investigating')
  incidentStatusRef.current = (id: string) => incidents[id]?.status ?? 'investigating'

  // ── Lifecycle transition (internal) ─────────────────────────────────────────
  const transition = useCallback(
    (id: string, to: IncidentLifecycle) => {
      const now = new Date().toISOString()
      setIncidents((prev) => {
        const rec = prev[id] ?? blankRecord(id)
        if (rec.status === to) return prev
        return {
          ...prev,
          [id]: {
            ...rec,
            status: to,
            resolvedAt: to === 'resolved' ? now : rec.resolvedAt,
            closedAt: to === 'closed' ? now : rec.closedAt,
          },
        }
      })
      appendEvent({
        incidentId: id,
        kind: 'state_transition',
        title: `Status → ${LIFECYCLE_LABELS[to]}`,
        description: `Incident ${id} moved to ${LIFECYCLE_LABELS[to]}.`,
        source: 'Operator',
        confidence: 100,
      })
      const intent = to === 'resolved' || to === 'closed' ? 'success' : 'info'
      notify({ title: `Incident ${LIFECYCLE_LABELS[to]}`, body: id, intent })
    },
    [appendEvent, notify],
  )

  const submitActionJob = useCallback(
    (action: ApiRecommendedAction) => {
      const existing = jobs[action.id]
      if (existing && (existing.status === 'submitting' || existing.status === 'running')) return

      const incidentId = action.incident_id
      const jobId = nextId('JOB')
      const submittedAt = new Date().toISOString()

      setJobs((prev) => ({
        ...prev,
        [action.id]: {
          jobId,
          actionId: action.id,
          actionTitle: action.title,
          actionType: action.type,
          status: 'submitting',
          submittedAt,
          completedAt: null,
        },
      }))

      appendEvent({
        incidentId,
        kind: 'action_submitted',
        title: `Remediation submitted — ${action.title}`,
        description: `${action.type_label} job ${jobId} queued for execution.`,
        source: 'Operator',
        confidence: 100,
      })
      notify({ title: 'Job submitted', body: `${action.title} · ${jobId}`, intent: 'info' })

      // Executing a remediation moves the incident to Mitigating.
      if (ACTIONABLE.has(incidentStatusRef.current(incidentId))) {
        transition(incidentId, 'mitigating')
      }

      setTimeout(() => {
        setJobs((prev) =>
          prev[action.id]?.jobId === jobId
            ? { ...prev, [action.id]: { ...prev[action.id], status: 'running' } }
            : prev,
        )
      }, RUNNING_AFTER_MS)

      setTimeout(() => {
        const completedAt = new Date().toISOString()
        setJobs((prev) =>
          prev[action.id]?.jobId === jobId
            ? { ...prev, [action.id]: { ...prev[action.id], status: 'succeeded', completedAt } }
            : prev,
        )
        appendEvent({
          incidentId,
          kind: 'action_succeeded',
          title: `Remediation completed — ${action.title}`,
          description: `${action.type_label} job ${jobId} completed successfully.`,
          source: 'Operator',
          confidence: 100,
        })
        notify({
          title: 'Remediation succeeded',
          body: `${action.title} completed`,
          intent: 'success',
        })
        // Successful remediation moves the incident to Monitoring.
        if (ACTIONABLE.has(incidentStatusRef.current(incidentId))) {
          transition(incidentId, 'monitoring')
        }
      }, SUCCEEDED_AFTER_MS)
    },
    [jobs, nextId, appendEvent, notify, transition],
  )

  const createInvestigation = useCallback(
    async (input: { description: string; affectedServices: string[] }) => {
      // REAL backend investigation — no client-side fabrication. The orchestrator
      // runs over live telemetry; activity/records appear only because a real run
      // happened. On failure we surface the error and create nothing.
      try {
        const created = await incidentsApi.create({
          description: input.description,
          affected_services: input.affectedServices,
        })
        const id = created.id
        setIncidents((prev) => ({
          ...prev,
          [id]: { ...blankRecord(id), title: input.description.slice(0, 80), startedAt: created.created_at },
        }))
        appendEvent({
          incidentId: id,
          kind: 'investigation_created',
          title: 'Investigation created',
          description: input.description,
          source: 'Operator',
          confidence: 100,
        })
        notify({ title: 'Investigation started', body: `${id} · real agents dispatched`, intent: 'success' })
      } catch (e) {
        notify({
          title: 'Could not start investigation',
          body: e instanceof Error ? e.message : 'Backend unreachable.',
          intent: 'error',
        })
      }
    },
    [appendEvent, notify],
  )

  const registerIncident = useCallback((id: string, meta: IncidentMeta) => {
    setIncidents((prev) => {
      const rec = prev[id] ?? blankRecord(id)
      const merged: IncidentSessionRecord = {
        ...rec,
        title: meta.title ?? rec.title,
        rootCause: meta.rootCause ?? rec.rootCause,
        impactUsd: meta.impactUsd ?? rec.impactUsd,
        blastRadius: meta.blastRadius ?? rec.blastRadius,
        startedAt: meta.startedAt ?? rec.startedAt,
      }
      const unchanged =
        prev[id] &&
        merged.title === rec.title &&
        merged.rootCause === rec.rootCause &&
        merged.impactUsd === rec.impactUsd &&
        merged.blastRadius === rec.blastRadius &&
        merged.startedAt === rec.startedAt
      return unchanged ? prev : { ...prev, [id]: merged }
    })
  }, [])

  const incidentStatus = useCallback(
    (id: string): IncidentLifecycle => incidents[id]?.status ?? 'investigating',
    [incidents],
  )
  const incidentRecord = useCallback((id: string) => incidents[id], [incidents])

  const markResolved = useCallback((id: string) => transition(id, 'resolved'), [transition])
  const closeIncident = useCallback((id: string) => transition(id, 'closed'), [transition])
  // Re-open a closed/resolved incident back into an actionable investigating state.
  const reopenIncident = useCallback((id: string) => transition(id, 'investigating'), [transition])

  const closedIncidents = useMemo(
    () => Object.values(incidents).filter((r) => r.status === 'closed'),
    [incidents],
  )

  const value = useMemo<SessionContextValue>(
    () => ({
      jobs,
      timelineEvents,
      incidents,
      closedIncidents,
      submitActionJob,
      createInvestigation,
      registerIncident,
      incidentStatus,
      incidentRecord,
      markResolved,
      closeIncident,
      reopenIncident,
    }),
    [
      jobs,
      timelineEvents,
      incidents,
      closedIncidents,
      submitActionJob,
      createInvestigation,
      registerIncident,
      incidentStatus,
      incidentRecord,
      markResolved,
      closeIncident,
      reopenIncident,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>')
  return ctx
}

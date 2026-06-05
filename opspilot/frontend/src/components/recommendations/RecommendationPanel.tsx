/**
 * Dashboard (home) — enterprise incident command surface.
 *
 * Refactored from a static report (giant fully-expanded cards) into an
 * interactive command center built on progressive disclosure:
 *
 *   1. Incident Summary  — compact KPI strip (ID, severity, status, confidence,
 *                          blast radius, cost). Summary density only.
 *   2. Investigation Queue — Fluent Table (Agent | Status | Confidence | Duration).
 *                          Row click opens AgentDetailsDrawer (no navigation away).
 *   3. Recommended Actions — compact tiles. Tile click opens RecommendationDrawer
 *                          with the full execution playbook.
 *
 * Reuses shared primitives (SeverityBadge, AgentStatusBadge, ConfidenceBar,
 * DetailDrawer) and the timezone-aware formatters so every timestamp follows
 * the global local/UTC toggle.
 */
import React, { useEffect, useMemo, useState } from 'react'
import {
  makeStyles,
  tokens,
  Button,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableBody,
  TableCell,
  TableCellLayout,
  mergeClasses,
} from '@fluentui/react-components'
import {
  BotRegular,
  DataTrendingRegular,
  SearchRegular,
  RocketRegular,
  HistoryRegular,
  ChevronRightRegular,
  ArrowUndoRegular,
  WrenchRegular,
  ServerRegular,
  CheckmarkCircleRegular,
  LockClosedRegular,
} from '@fluentui/react-icons'
import { useActiveIncidentWithRecommendations } from '../../hooks/useIncident'
import { useIncidentStream } from '../../hooks/useIncidentStream'
import type { ApiAgentTask } from '../../api/agents'
import type { ApiRecommendedAction } from '../../api/recommendations'
import { StreamStatusBadge } from '../shared/StreamStatusBadge'
import { SeverityBadge, AgentStatusBadge, RiskBadge, IncidentStatusBadge } from '../shared/SeverityBadge'
import { ConfidenceBar } from '../shared/ConfidenceBar'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { AgentDetailsDrawer } from '../agents/AgentDetailsDrawer'
import { RecommendationDrawer } from './RecommendationDrawer'
import { ActionStatusBadge } from '../actions/ActionStatusBadge'
import { useSession } from '../../store/SessionContext'
import { useFormatters } from '../../store/PreferencesContext'
import { ACTIVE_INCIDENT_ID } from '../../utils/constants'
import { formatCurrency, formatCompactNumber, formatDuration } from '../../utils/formatters'
import { confidenceColor } from '../../theme/tokens'

// ── Agent role → icon ─────────────────────────────────────────────────────────
const AGENT_ICON: Record<string, React.FC> = {
  commander: BotRegular,
  metrics: DataTrendingRegular,
  logs: SearchRegular,
  deployment: RocketRegular,
  time_machine: HistoryRegular,
}

// ── Recommendation type → icon ──────────────────────────────────────────────
const REC_ICON: Record<string, React.FC> = {
  rollback: ArrowUndoRegular,
  fix: WrenchRegular,
  infrastructure: ServerRegular,
}

const useStyles = makeStyles({
  page: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' },

  // header
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },

  // ── Incident summary strip (compact KPIs) ───────────────────────────────────
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1px',
    backgroundColor: tokens.colorNeutralStroke1,
    borderRadius: '8px',
    overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  kpi: {
    backgroundColor: tokens.colorNeutralBackground2,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  kpiLabel: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },
  kpiValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: tokens.colorNeutralForeground1,
    letterSpacing: '-0.4px',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mono: { fontFamily: '"Cascadia Code", "Consolas", monospace', fontSize: '15px' },
  kpiWait: { fontSize: '18px', fontWeight: 600, color: tokens.colorNeutralForeground4 },
  waitRow: { padding: '16px', fontSize: '13px', color: tokens.colorNeutralForeground3 },

  // ── Table ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  row: {
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorNeutralBackground3 },
  },
  agentCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  agentIcon: { fontSize: '18px', color: tokens.colorBrandForeground1, display: 'flex' },
  agentName: { fontWeight: 600, color: tokens.colorNeutralForeground1 },
  agentRole: { fontSize: '11px', color: tokens.colorNeutralForeground3 },
  confCell: { width: '180px' },
  durCell: { fontVariantNumeric: 'tabular-nums', color: tokens.colorNeutralForeground2 },
  chevron: { color: tokens.colorNeutralForeground3 },

  // ── Recommendation tiles ─────────────────────────────────────────────────────
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  tile: {
    position: 'relative',
    textAlign: 'left',
    cursor: 'pointer',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
    ':hover': {
      transform: 'translateY(-2px)',
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
    },
  },
  tileHead: { display: 'flex', alignItems: 'center', gap: '10px' },
  tilePriority: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: `1.5px solid ${tokens.colorNeutralStroke2}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    color: tokens.colorNeutralForeground2,
    flexShrink: 0,
  },
  tileIcon: { fontSize: '18px', color: tokens.colorBrandForeground1, display: 'flex' },
  tileTitle: { fontSize: '14px', fontWeight: 600, color: tokens.colorNeutralForeground1, lineHeight: 1.3 },
  tileFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  tileEta: { fontSize: '11px', color: tokens.colorNeutralForeground3, fontFamily: '"Cascadia Code", "Consolas", monospace' },
  tileStatusSlot: { marginLeft: 'auto' },

  // ── Live activity feed ───────────────────────────────────────────────────────
  activity: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    padding: '8px 0',
  },
  activityRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '8px 16px',
  },
  activityDot: {
    width: '8px',
    height: '8px',
    minWidth: '8px',
    borderRadius: '50%',
    marginTop: '5px',
  },
  activityMain: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
  activityTitle: { fontSize: '13px', fontWeight: 600, color: tokens.colorNeutralForeground1 },
  activityDesc: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  activityTime: {
    marginLeft: 'auto',
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' },
  error: {
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    borderRadius: '8px',
    padding: '16px 20px',
    color: tokens.colorPaletteRedForeground1,
    backgroundColor: tokens.colorNeutralBackground2,
  },
})

interface KpiProps {
  label: string
  children: React.ReactNode
}
const Kpi: React.FC<KpiProps> = ({ label, children }) => {
  const s = useStyles()
  return (
    <div className={s.kpi}>
      <span className={s.kpiLabel}>{label}</span>
      {children}
    </div>
  )
}

/** A live agent row, built purely from SSE events (no mock baseline). */
interface LiveAgent {
  role: string
  status: string
  confidence?: number
  finding?: string
  evidence?: string[]
  started_at?: string
  completed_at?: string
  duration_ms?: number
}

const ROLE_LABEL: Record<string, string> = {
  commander: 'Commander',
  metrics: 'Metrics',
  logs: 'Logs',
  deployment: 'Deployment',
  time_machine: 'Correlation',
  root_cause: 'Root Cause',
  reasoning: 'Deep Reasoning',
  recommendation: 'Recommendation',
}

export const RecommendationPanel: React.FC = () => {
  const s = useStyles()
  const { status: streamStatus, events } = useIncidentStream(ACTIVE_INCIDENT_ID)
  const incidentState = useActiveIncidentWithRecommendations() // incident metadata only
  const { jobs, timelineEvents, incidentStatus, registerIncident, markResolved, closeIncident } =
    useSession()
  const fmt = useFormatters()
  const [confirm, setConfirm] = useState<'resolved' | 'closed' | null>(null)

  // ── Live investigation results — folded from the FULL SSE event log. ───────
  //    Folding over the complete `events` array (rather than reacting to a
  //    single `lastEvent`) means no event is lost to React batching, so
  //    agent.finding / root_cause.updated are always applied. SSE-only; the
  //    dashboard shows waiting states until events arrive.
  const live = useMemo(() => {
    const agents: Record<string, LiveAgent> = {}
    let rootCause: {
      confidence: number
      title: string
      blast_radius: number
      affected_users: number
      hourly_impact_usd: number
    } | null = null
    let actions: ApiRecommendedAction[] | null = null
    let severity: string | null = null
    for (const ev of events) {
      const role = ev.agent_name
      const p = ev.payload as Record<string, unknown>
      if (ev.event_type === 'root_cause.updated') {
        rootCause = {
          confidence: p.confidence as number,
          title: p.title as string,
          blast_radius: p.blast_radius as number,
          affected_users: p.affected_users as number,
          hourly_impact_usd: p.hourly_impact_usd as number,
        }
      } else if (ev.event_type === 'agent.started') {
        agents[role] = { ...(agents[role] ?? {}), role, status: 'running', started_at: ev.timestamp }
      } else if (ev.event_type === 'agent.completed') {
        agents[role] = {
          ...(agents[role] ?? { role, status: 'running' }),
          role,
          status: 'completed',
          completed_at: ev.timestamp,
          duration_ms: p.duration_ms as number,
        }
      } else if (ev.event_type === 'agent.finding') {
        const meta = p.metadata as { actions?: unknown[]; severity?: string } | undefined
        if (role === 'recommendation' && Array.isArray(meta?.actions)) {
          actions = meta.actions as unknown as ApiRecommendedAction[]
        }
        if (role === 'commander' && typeof meta?.severity === 'string') severity = meta.severity
        agents[role] = {
          ...(agents[role] ?? { role, status: 'running' }),
          role,
          confidence: p.confidence as number,
          finding: p.summary as string,
          evidence: (p.evidence as string[]) ?? [],
        }
      }
    }
    return { agents, rootCause, actions, severity }
  }, [events])

  const liveRootCause = live.rootCause

  // Drawer selection state
  const [selectedAgent, setSelectedAgent] = useState<ApiAgentTask | null>(null)
  const [selectedRec, setSelectedRec] = useState<ApiRecommendedAction | null>(null)

  const incident = incidentState.data?.incident
  const lifecycle = incidentStatus(ACTIVE_INCIDENT_ID)
  const canResolve = lifecycle !== 'resolved' && lifecycle !== 'closed'
  const canClose = lifecycle === 'resolved'

  // Live queue rows, built purely from SSE (insertion order = agent start order).
  const queueAgents: ApiAgentTask[] = Object.values(live.agents).map((la) => ({
    id: la.role,
    incident_id: ACTIVE_INCIDENT_ID,
    role: la.role,
    role_label: ROLE_LABEL[la.role] ?? la.role,
    status: la.status,
    confidence: la.confidence ?? 0,
    finding: la.finding ?? '',
    evidence: la.evidence ?? [],
    tools_called: [],
    started_at: la.started_at ?? null,
    completed_at: la.completed_at ?? null,
    duration_seconds: la.duration_ms != null ? la.duration_ms / 1000 : null,
  }))
  const recActions = live.actions ? [...live.actions].sort((a, b) => a.priority - b.priority) : []
  // Severity comes live from the Commander's intake finding (no mock fallback).
  const severity = live.severity

  // Register the live root cause so History shows real values once closed.
  useEffect(() => {
    if (!liveRootCause) return
    registerIncident(ACTIVE_INCIDENT_ID, {
      title: liveRootCause.title,
      rootCause: liveRootCause.title,
      impactUsd: liveRootCause.hourly_impact_usd,
      blastRadius: liveRootCause.blast_radius,
      startedAt: incident?.created_at ?? null,
    })
  }, [liveRootCause, incident, registerIncident])

  return (
    <div className={s.page}>
      {/* ── Incident summary ───────────────────────────────────────────────── */}
      <div className={s.headerRow}>
        <span className={s.sectionLabel}>Incident Summary</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IncidentStatusBadge status={lifecycle} />
          <Button
            size="small"
            appearance="secondary"
            icon={<CheckmarkCircleRegular />}
            disabled={!canResolve}
            onClick={() => setConfirm('resolved')}
          >
            Mark Resolved
          </Button>
          <Button
            size="small"
            appearance="secondary"
            icon={<LockClosedRegular />}
            disabled={!canClose}
            onClick={() => setConfirm('closed')}
          >
            Close Incident
          </Button>
          <StreamStatusBadge status={streamStatus} />
        </div>
      </div>

      <div className={s.summary}>
        <Kpi label="Incident">
          <span className={mergeClasses(s.kpiValue, s.mono)}>{ACTIVE_INCIDENT_ID}</span>
        </Kpi>
        <Kpi label="Severity">
          <span>
            {severity ? (
              <SeverityBadge severity={severity} pill />
            ) : (
              <span className={s.kpiWait}>—</span>
            )}
          </span>
        </Kpi>
        <Kpi label="Status">
          <span>
            <IncidentStatusBadge status={lifecycle} />
          </span>
        </Kpi>
        <Kpi label="Confidence">
          {liveRootCause ? (
            <span className={s.kpiValue} style={{ color: confidenceColor(liveRootCause.confidence) }}>
              {Math.round(liveRootCause.confidence)}%
            </span>
          ) : (
            <span className={s.kpiWait}>—</span>
          )}
        </Kpi>
        <Kpi label="Blast Radius">
          {liveRootCause ? (
            <span className={s.kpiValue}>
              {liveRootCause.blast_radius} svc · {formatCompactNumber(liveRootCause.affected_users)} users
            </span>
          ) : (
            <span className={s.kpiWait}>—</span>
          )}
        </Kpi>
        <Kpi label="Cost Impact">
          {liveRootCause ? (
            <span className={s.kpiValue} style={{ color: '#f87171' }}>
              {formatCurrency(liveRootCause.hourly_impact_usd)}/hr
            </span>
          ) : (
            <span className={s.kpiWait}>—</span>
          )}
        </Kpi>
      </div>

      {/* ── Investigation queue ────────────────────────────────────────────── */}
      <span className={s.sectionLabel}>Investigation Queue</span>
      <div className={s.card}>
        <Table aria-label="Investigation queue" size="medium">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Agent</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className={s.confCell}>Confidence</TableHeaderCell>
              <TableHeaderCell>Duration</TableHeaderCell>
              <TableHeaderCell style={{ width: '40px' }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {queueAgents.map((a) => {
              const Icon = AGENT_ICON[a.role] ?? BotRegular
              return (
                <TableRow
                  key={a.id}
                  className={s.row}
                  onClick={() => setSelectedAgent(a)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedAgent(a)
                  }}
                >
                  <TableCell>
                    <TableCellLayout>
                      <div className={s.agentCell}>
                        <span className={s.agentIcon}>
                          <Icon />
                        </span>
                        <div>
                          <div className={s.agentName}>{a.role_label}</div>
                          <div className={s.agentRole}>{a.role}</div>
                        </div>
                      </div>
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <AgentStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className={s.confCell}>
                    <ConfidenceBar value={a.confidence} animate={false} />
                  </TableCell>
                  <TableCell className={s.durCell}>{formatDuration(a.duration_seconds)}</TableCell>
                  <TableCell>
                    <ChevronRightRegular className={s.chevron} />
                  </TableCell>
                </TableRow>
              )
            })}
            {queueAgents.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} style={{ color: tokens.colorNeutralForeground3 }}>
                  {streamStatus === 'connected'
                    ? 'Waiting for investigation — agents will appear as they run…'
                    : 'Connecting to investigation stream…'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Recommended actions ────────────────────────────────────────────── */}
      <span className={s.sectionLabel}>Recommended Actions</span>
      {recActions.length === 0 ? (
        <div className={s.card}>
          <div className={s.waitRow}>
            No recommendations yet — generated live once the investigation reaches the Recommendation agent.
          </div>
        </div>
      ) : (
        <div className={s.tiles}>
          {recActions.map((action) => {
            const Icon = REC_ICON[action.type] ?? WrenchRegular
            const job = jobs[action.id]
            return (
              <button key={action.id} className={s.tile} onClick={() => setSelectedRec(action)}>
              <div className={s.tileHead}>
                <span className={s.tilePriority}>{action.priority}</span>
                <span className={s.tileIcon}>
                  <Icon />
                </span>
                <span className={s.tileTitle}>{action.type_label}</span>
                {job && (
                  <span className={s.tileStatusSlot}>
                    <ActionStatusBadge status={job.status} />
                  </span>
                )}
              </div>
              <span className={s.tileTitle} style={{ fontWeight: 400, fontSize: '13px' }}>
                {action.title}
              </span>
              <div className={s.tileFooter}>
                <RiskBadge risk={action.risk} label={action.risk_label} />
                <span className={s.tileEta}>{action.estimated_time}</span>
              </div>
            </button>
            )
          })}
        </div>
      )}

      {/* ── Live activity (session events: executions, investigations) ──────── */}
      {timelineEvents.length > 0 && (
        <>
          <span className={s.sectionLabel}>Live Activity</span>
          <div className={s.activity}>
            {[...timelineEvents].reverse().map((e) => {
              const color =
                e.kind === 'action_succeeded'
                  ? '#22c55e'
                  : e.kind === 'action_failed'
                    ? '#dc2626'
                    : e.kind === 'investigation_created'
                      ? '#3b82f6'
                      : '#f59e0b'
              return (
                <div key={e.id} className={s.activityRow}>
                  <span className={s.activityDot} style={{ backgroundColor: color }} />
                  <div className={s.activityMain}>
                    <span className={s.activityTitle}>{e.title}</span>
                    <span className={s.activityDesc}>{e.description}</span>
                  </div>
                  <span className={s.activityTime}>{fmt.time(e.timestamp)}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Drawers ────────────────────────────────────────────────────────── */}
      <AgentDetailsDrawer
        task={selectedAgent}
        open={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
      />
      <RecommendationDrawer
        action={selectedRec}
        open={selectedRec !== null}
        onClose={() => setSelectedRec(null)}
      />

      {/* ── Lifecycle confirmations ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirm === 'resolved'}
        title="Mark incident as Resolved?"
        message="Confirm the incident is mitigated and recovery is verified. This records a Resolved state transition on the timeline."
        confirmLabel="Mark Resolved"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          markResolved(ACTIVE_INCIDENT_ID)
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === 'closed'}
        title="Close this incident?"
        message="Closing moves the incident to History as a closed record. This cannot be undone in the current session."
        confirmLabel="Close Incident"
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          closeIncident(ACTIVE_INCIDENT_ID)
          setConfirm(null)
        }}
      />
    </div>
  )
}

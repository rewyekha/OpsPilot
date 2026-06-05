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
  Spinner,
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
import { useRecommendations } from '../../hooks/useRecommendations'
import { useAgentActivity } from '../../hooks/useAgentActivity'
import { useActiveIncidentWithRecommendations } from '../../hooks/useIncident'
import { useIncidentStream } from '../../hooks/useIncidentStream'
import type { ApiAgentTask } from '../../api/agents'
import type { ApiRecommendedAction } from '../../api/recommendations'
import { StreamStatusBadge } from '../shared/StreamStatusBadge'
import { SeverityBadge, AgentStatusBadge, RiskBadge, IncidentStatusBadge } from '../shared/SeverityBadge'
import { ConfidenceBar } from '../shared/ConfidenceBar'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { AgentDetailsDrawer } from '../agents/AgentDetailsDrawer'
import { MonitoredServices } from '../services/MonitoredServices'
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

export const RecommendationPanel: React.FC = () => {
  const s = useStyles()
  const recState = useRecommendations(ACTIVE_INCIDENT_ID)
  const agentState = useAgentActivity(ACTIVE_INCIDENT_ID)
  const incidentState = useActiveIncidentWithRecommendations()
  const { status: streamStatus, lastEvent } = useIncidentStream(ACTIVE_INCIDENT_ID)
  const { jobs, timelineEvents, incidentStatus, registerIncident, markResolved, closeIncident } =
    useSession()
  const fmt = useFormatters()
  const [confirm, setConfirm] = useState<'resolved' | 'closed' | null>(null)

  // Live confidence — seeded from HTTP, updated by SSE root_cause.updated
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null)
  useEffect(() => {
    if (lastEvent?.event_type === 'root_cause.updated') {
      const c = lastEvent.payload.confidence
      if (typeof c === 'number') setLiveConfidence(c)
    }
  }, [lastEvent])

  // Drawer selection state
  const [selectedAgent, setSelectedAgent] = useState<ApiAgentTask | null>(null)
  const [selectedRec, setSelectedRec] = useState<ApiRecommendedAction | null>(null)

  const rootCause = recState.data?.root_cause
  const actions = useMemo(
    () => [...(recState.data?.actions ?? [])].sort((a, b) => a.priority - b.priority),
    [recState.data],
  )
  const agents = agentState.data?.agents ?? []
  const incident = incidentState.data?.incident

  const confidence = liveConfidence ?? rootCause?.confidence ?? 0
  const lifecycle = incidentStatus(ACTIVE_INCIDENT_ID)
  const canResolve = lifecycle !== 'resolved' && lifecycle !== 'closed'
  const canClose = lifecycle === 'resolved'

  // Seed lifecycle record with display meta so History can show it once closed.
  useEffect(() => {
    if (!rootCause) return
    registerIncident(ACTIVE_INCIDENT_ID, {
      title: rootCause.title,
      rootCause: rootCause.title,
      impactUsd: rootCause.hourly_impact_usd,
      blastRadius: rootCause.blast_radius,
      startedAt: incident?.created_at ?? null,
    })
  }, [rootCause, incident, registerIncident])

  if (recState.loading) {
    return (
      <div className={s.center}>
        <Spinner label="Loading incident…" />
      </div>
    )
  }

  if (recState.error || !rootCause) {
    return (
      <div className={s.page}>
        <div className={s.error}>{recState.error ?? 'No incident data available.'}</div>
      </div>
    )
  }

  return (
    <div className={s.page}>
      {/* ── Incident summary ───────────────────────────────────────────────── */}
      <div className={s.headerRow}>
        <span className={s.sectionLabel}>Incident Summary</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Lifecycle status is shown once, in the Status KPI below (Phase 8 UX:
              removed the duplicate badge here — the KPI is the single source). */}
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
          <span className={mergeClasses(s.kpiValue, s.mono)}>{rootCause.incident_id}</span>
        </Kpi>
        <Kpi label="Severity">
          <span>
            <SeverityBadge severity={incident?.severity ?? 'P1'} pill />
          </span>
        </Kpi>
        <Kpi label="Status">
          <span>
            <IncidentStatusBadge status={lifecycle} />
          </span>
        </Kpi>
        <Kpi label="Confidence">
          <span className={s.kpiValue} style={{ color: confidenceColor(confidence) }}>
            {Math.round(confidence)}%
          </span>
        </Kpi>
        <Kpi label="Blast Radius">
          <span className={s.kpiValue}>
            {rootCause.blast_radius} svc · {formatCompactNumber(rootCause.affected_users)} users
          </span>
        </Kpi>
        <Kpi label="Cost Impact">
          <span className={s.kpiValue} style={{ color: '#f87171' }}>
            {formatCurrency(rootCause.hourly_impact_usd)}/hr
          </span>
        </Kpi>
      </div>

      {/* ── Monitored services ─────────────────────────────────────────────── */}
      <MonitoredServices />

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
            {agents.map((a) => {
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
            {agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} style={{ color: tokens.colorNeutralForeground3 }}>
                  {agentState.loading ? 'Loading agents…' : 'No agents dispatched yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Recommended actions ────────────────────────────────────────────── */}
      <span className={s.sectionLabel}>Recommended Actions</span>
      <div className={s.tiles}>
        {actions.map((action) => {
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

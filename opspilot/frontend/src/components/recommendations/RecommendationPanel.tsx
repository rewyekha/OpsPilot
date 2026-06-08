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
import React, { useMemo, useState } from 'react'
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
  OpenRegular,
} from '@fluentui/react-icons'
import { useLiveInvestigation } from '../../hooks/useLiveInvestigation'
import { useLatestInvestigation } from '../../hooks/useInsights'
import type { ApiRecommendedAction } from '../../api/recommendations'
import type { StoredAction } from '../../api/insights'
import { EmptyState } from '../shared/EmptyState'
import { StreamStatusBadge } from '../shared/StreamStatusBadge'
import { SeverityBadge, AgentStatusBadge, RiskBadge, IncidentStatusBadge } from '../shared/SeverityBadge'
import { ConfidenceBar } from '../shared/ConfidenceBar'
import { AgentBlade, type AgentLike } from '../agents/AgentBlade'
import { MonitoredServices } from '../services/MonitoredServices'
import { DashboardSummary } from '../dashboard/DashboardSummary'
import { InvestigationBlade } from '../incident/InvestigationBlade'
import { AnalyticsBlade } from '../analytics/AnalyticsBlade'
import { RecommendationDrawer } from './RecommendationDrawer'
import { ActionStatusBadge } from '../actions/ActionStatusBadge'
import { useSession } from '../../store/SessionContext'
import { useFormatters } from '../../store/PreferencesContext'
import { useActiveIncidents } from '../../hooks/useActiveIncidents'
import { MonitorBadge } from '../shared/MonitorBadge'
import { useMountLog } from '../../utils/debugMountLog' // TEMP-DEBUG
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
  useMountLog('RecommendationPanel') // TEMP-DEBUG
  // Single source of truth — the latest persisted investigation. The incident
  // summary, confidence, blast radius, cost and recommendations all come from a
  // real completed run (or the empty state); nothing is seeded from static data.
  const latest = useLatestInvestigation()
  // Currently-active incidents (telemetry-detected by the autonomous monitor or
  // user-created). Polled so an AUTO-detected incident appears here in real time.
  const active = useActiveIncidents()
  // Live investigation queue — driven entirely by real SSE orchestrator events.
  // Watches the active incident if one exists (so the autonomous run streams live
  // before its record persists), else the latest persisted investigation.
  // Read-only; opening the stream never starts a run. Empty id → no stream.
  const watchId = active.data?.[0]?.id ?? latest.data?.incident_id ?? ''
  const live = useLiveInvestigation(watchId)
  const streamStatus = live.connection
  const { jobs, timelineEvents, incidentStatus } = useSession()
  const fmt = useFormatters()
  const [investigationOpen, setInvestigationOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  // Drawer selection state
  const [selectedAgent, setSelectedAgent] = useState<AgentLike | null>(null)
  const [selectedRec, setSelectedRec] = useState<ApiRecommendedAction | null>(null)

  const record = latest.data
  const hasRecord = !!record
  const rootCause = record?.root_cause
  const toAction = (r: StoredAction): ApiRecommendedAction => ({
    incident_id: record?.incident_id ?? '',
    id: r.id, priority: r.priority, type: r.type, type_label: r.type_label,
    title: r.title, description: r.description, steps: r.steps ?? [],
    risk: r.risk, risk_label: r.risk_label, impact: r.impact, impact_label: r.impact_label,
    estimated_time: r.estimated_time,
  })
  const actions = useMemo(
    () => [...(record?.recommendations ?? [])].sort((a, b) => a.priority - b.priority).map(toAction),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record],
  )
  const agents = live.agents

  // Confidence: live (SSE) while running, else the real persisted value.
  const confidence = live.confidence ?? record?.combined_confidence ?? 0
  const lifecycle = incidentStatus(record?.incident_id ?? '')

  if (latest.loading) {
    return (
      <div className={s.center}>
        <Spinner label="Loading investigation…" />
      </div>
    )
  }

  return (
    <div className={s.page}>
      {/* ── Incident summary ───────────────────────────────────────────────── */}
      <div className={s.headerRow}>
        <span className={s.sectionLabel}>Incident Summary</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MonitorBadge />
          {/* One primary action per card — all investigation actions live inside
              the blade modal (Azure Portal / Grafana interaction model). */}
          <Button
            size="small"
            appearance="primary"
            icon={<OpenRegular />}
            onClick={() => setInvestigationOpen(true)}
          >
            Open Investigation
          </Button>
          <StreamStatusBadge status={streamStatus} />
        </div>
      </div>

      {hasRecord && record && rootCause ? (
        <>
        <div className={s.summary}>
          <Kpi label="Incident">
            <span className={mergeClasses(s.kpiValue, s.mono)}>{record.incident_id}</span>
          </Kpi>
          <Kpi label="Severity">
            <span>{record.severity ? <SeverityBadge severity={record.severity} pill /> : <span className={s.kpiValue}>—</span>}</span>
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
              {rootCause.blast_radius || rootCause.affected_users
                ? `${rootCause.blast_radius} svc · ${formatCompactNumber(rootCause.affected_users)} users`
                : '—'}
            </span>
          </Kpi>
          <Kpi label="Cost Impact">
            <span className={s.kpiValue} style={{ color: '#f87171' }}>
              {rootCause.hourly_impact_usd ? `${formatCurrency(rootCause.hourly_impact_usd)}/hr` : '—'}
            </span>
          </Kpi>
        </div>
        {rootCause.blast_radius || rootCause.affected_users || rootCause.hourly_impact_usd ? (
          <div style={{ fontSize: '11px', color: tokens.colorNeutralForeground4, marginTop: '2px' }}>
            Blast radius, affected users and cost impact are estimated by the Root Cause agent from telemetry evidence.
          </div>
        ) : null}
        </>
      ) : (
        <div className={s.card}>
          <EmptyState
            title="No investigations yet"
            body="Run an investigation to populate the incident summary, confidence, blast radius and recommendations — all from real agent execution."
            actionLabel="Open Investigation"
            onAction={() => setInvestigationOpen(true)}
          />
        </div>
      )}

      {/* ── Investigation overview ─────────────────────────────────────────── */}
      <div className={s.headerRow}>
        <span className={s.sectionLabel}>Overview</span>
        <Button size="small" appearance="primary" icon={<OpenRegular />} onClick={() => setAnalyticsOpen(true)}>
          Open Analytics
        </Button>
      </div>
      <DashboardSummary />

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
              const badgeStatus = a.status === 'complete' ? 'completed' : a.status
              const openAgent = () =>
                setSelectedAgent({
                  role: a.role,
                  role_label: a.label,
                  status: badgeStatus,
                  confidence: a.confidence,
                  duration_seconds: a.durationMs / 1000,
                  finding: a.finding,
                  evidence: [],
                  incident_id: record?.incident_id ?? '',
                })
              return (
                <TableRow
                  key={a.role}
                  className={s.row}
                  onClick={openAgent}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openAgent() }}
                >
                  <TableCell>
                    <TableCellLayout>
                      <div className={s.agentCell}>
                        <span className={s.agentIcon}>
                          <Icon />
                        </span>
                        <div>
                          <div className={s.agentName}>{a.label}</div>
                          <div className={s.agentRole}>{a.role}</div>
                        </div>
                      </div>
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <AgentStatusBadge status={badgeStatus} />
                  </TableCell>
                  <TableCell className={s.confCell}>
                    <ConfidenceBar value={a.confidence} animate={false} />
                  </TableCell>
                  <TableCell className={s.durCell}>{a.durationMs ? formatDuration(a.durationMs / 1000) : '—'}</TableCell>
                  <TableCell>
                    <ChevronRightRegular className={s.chevron} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Recommended actions (from the persisted investigation) ─────────── */}
      {actions.length > 0 && (
      <>
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
      </>
      )}

      {/* ── Live activity (real operator/investigation session events) ──────── */}
      <span className={s.sectionLabel}>Live Activity</span>
      {timelineEvents.length === 0 ? (
        <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground4, padding: '4px 0' }}>
          No investigation activity
        </div>
      ) : (
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
      )}

      {/* ── Drawers / blades ───────────────────────────────────────────────── */}
      <AgentBlade
        agent={selectedAgent}
        open={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
      />
      <RecommendationDrawer
        action={selectedRec}
        open={selectedRec !== null}
        onClose={() => setSelectedRec(null)}
      />

      {/* ── Blades (entity actions live inside these modals) ────────────────── */}
      <InvestigationBlade open={investigationOpen} onClose={() => setInvestigationOpen(false)} />
      <AnalyticsBlade
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        onOpenFull={() => window.dispatchEvent(new CustomEvent('opspilot:navigate', { detail: { page: 'analytics' } }))}
      />
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { makeStyles, tokens, mergeClasses, shorthands } from '@fluentui/react-components'
import {
  BotRegular,
  DataTrendingRegular,
  SearchRegular,
  RocketRegular,
  HistoryRegular,
} from '@fluentui/react-icons'
import { useAgentActivity } from '../../hooks/useAgentActivity'
import type { ApiAgentTask, ApiAgentActivityResponse } from '../../api/agents'
import { useIncidentStream } from '../../hooks/useIncidentStream'
import { StreamStatusBadge } from '../shared/StreamStatusBadge'

// ── Local types ────────────────────────────────────────────────────────────────

type AgentRole = 'commander' | 'metrics' | 'logs' | 'deployment' | 'time_machine'
type AgentStatus = 'completed' | 'running' | 'waiting'

interface AgentActivity {
  id: AgentRole
  name: string
  role: string
  status: AgentStatus
  startedAt: string
  completedAt: string | undefined
  durationLabel: string | undefined
  findings: string
  confidence: number
}

// ── Mapping helpers ────────────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: Record<string, string> = {
  commander:    'Incident Triage & Orchestration',
  metrics:      'APM & Infrastructure Telemetry',
  logs:         'Log Analytics & Pattern Recognition',
  deployment:   'Change Intelligence & Release Analysis',
  time_machine: 'Historical Baseline & Anomaly Correlation',
}

function formatUtcTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function normaliseStatus(s: string): AgentStatus {
  if (s === 'completed') return 'completed'
  if (s === 'running') return 'running'
  return 'waiting'
}

function mapTask(task: ApiAgentTask): AgentActivity {
  return {
    id: task.role as AgentRole,
    name: `${task.role_label} Agent`,
    role: ROLE_DESCRIPTIONS[task.role] ?? task.role_label,
    status: normaliseStatus(task.status),
    startedAt: task.started_at ? formatUtcTime(task.started_at) : '--:--:--',
    completedAt: task.completed_at ? formatUtcTime(task.completed_at) : undefined,
    durationLabel:
      task.duration_seconds != null ? formatSeconds(task.duration_seconds) : undefined,
    findings: task.finding,
    confidence: task.confidence,
  }
}

// ── Display configuration per status ─────────────────────────────────────────

interface StatusCfg {
  label: string
  chipBg: string
  chipBorder: string
  textColor: string
  accentColor: string
  dotColor: string
}

const STATUS_CFG: Record<AgentStatus, StatusCfg> = {
  completed: {
    label: 'COMPLETED',
    chipBg: 'rgba(34, 197, 94, 0.1)',
    chipBorder: 'rgba(34, 197, 94, 0.35)',
    textColor: '#4ade80',
    accentColor: '#22c55e',
    dotColor: '#22c55e',
  },
  running: {
    label: 'RUNNING',
    chipBg: 'rgba(59, 130, 246, 0.12)',
    chipBorder: 'rgba(59, 130, 246, 0.4)',
    textColor: '#60a5fa',
    accentColor: '#3b82f6',
    dotColor: '#3b82f6',
  },
  waiting: {
    label: 'WAITING',
    chipBg: 'rgba(100, 116, 139, 0.1)',
    chipBorder: 'rgba(100, 116, 139, 0.3)',
    textColor: '#94a3b8',
    accentColor: '#475569',
    dotColor: '#64748b',
  },
}

// ── Agent icon + identity color maps ─────────────────────────────────────────

const AGENT_ICONS: Record<AgentRole, React.ElementType> = {
  commander:    BotRegular,
  metrics:      DataTrendingRegular,
  logs:         SearchRegular,
  deployment:   RocketRegular,
  time_machine: HistoryRegular,
}

const AGENT_COLORS: Record<AgentRole, string> = {
  commander:    '#1d4ed8',
  metrics:      '#0891b2',
  logs:         '#7c3aed',
  deployment:   '#c2410c',
  time_machine: '#0f766e',
}

// Confidence level → hex color
const confColor = (c: number): string => {
  if (c >= 90) return '#4ade80'
  if (c >= 75) return '#3b82f6'
  if (c >= 60) return '#f59e0b'
  return '#ef4444'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  // Page wrapper
  page: {
    padding: '24px',
  },

  // ── Panel shell ─────────────────────────────────────────────────────────────
  panel: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: `0 0 0 1px ${tokens.colorNeutralStroke1}, 0 4px 24px rgba(0, 0, 0, 0.3)`,
  },

  // ── Panel header ────────────────────────────────────────────────────────────
  panelHeader: {
    padding: '18px 20px 0 20px',
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '5px',
  },
  panelLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontFamily: '"Cascadia Code", "Consolas", monospace',
  },
  liveChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    ...shorthands.border('1px', 'solid', 'rgba(59, 130, 246, 0.4)'),
    borderRadius: '20px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  // @keyframes ops-status-pulse defined in index.html
  liveDot: {
    width: '6px',
    height: '6px',
    minWidth: '6px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    animationName: 'ops-status-pulse',
    animationDuration: '1.5s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  liveText: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: '#60a5fa',
  },
  incidentTitle: {
    margin: '0 0 14px 0',
    padding: '0',
    fontSize: '16px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
  },

  // ── Stats row ───────────────────────────────────────────────────────────────
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    paddingTop: '12px',
    paddingBottom: '12px',
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '700',
    lineHeight: '1',
    color: tokens.colorNeutralForeground1,
  },
  statCompleted: {
    color: '#4ade80',
  },
  statRunning: {
    color: '#60a5fa',
  },
  statLabel: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: tokens.colorNeutralStroke1,
    flexShrink: 0,
  },

  // ── Scrollable agent list ───────────────────────────────────────────────────
  agentList: {
    padding: '16px 20px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflowY: 'auto',
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
  },

  // ── Agent card ──────────────────────────────────────────────────────────────
  agentCard: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '6px',
    overflow: 'hidden',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
  },
  agentCardRunning: {
    ...shorthands.border('1px', 'solid', 'rgba(59, 130, 246, 0.4)'),
    backgroundColor: 'rgba(59, 130, 246, 0.03)',
  },
  // Absolute left accent bar — color via inline style
  agentAccent: {
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '3px',
    zIndex: 1,
    pointerEvents: 'none',
  },
  agentContent: {
    paddingTop: '14px',
    paddingRight: '16px',
    paddingBottom: '14px',
    paddingLeft: '18px',
  },

  // ── Agent header row ─────────────────────────────────────────────────────────
  agentHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '11px',
  },
  agentIconWrap: {
    width: '34px',
    height: '34px',
    minWidth: '34px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  agentIcon: {
    width: '17px',
    height: '17px',
    color: '#ffffff',
  },
  agentInfo: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: '0',
  },
  agentName: {
    fontSize: '14px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.2',
  },
  agentRole: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
  },
  agentMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  timestamp: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    flexShrink: 0,
  },
  durationTag: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    paddingTop: '1px',
    paddingBottom: '1px',
    paddingLeft: '5px',
    paddingRight: '5px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '3px',
    flexShrink: 0,
  },

  // ── CSS spinner (running status) — @keyframes ops-spin in index.html ─────────
  spinner: {
    width: '10px',
    height: '10px',
    minWidth: '10px',
    borderRadius: '50%',
    ...shorthands.border('2px', 'solid', 'transparent'),
    borderTopColor: '#3b82f6',
    animationName: 'ops-spin',
    animationDuration: '0.7s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },

  // ── Findings ─────────────────────────────────────────────────────────────────
  findingsDivider: {
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
    marginBottom: '10px',
  },
  findings: {
    margin: '0 0 12px 0',
    padding: '0',
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.6',
  },
  findingsActive: {
    color: tokens.colorNeutralForeground1,
  },

  // ── Confidence bar ────────────────────────────────────────────────────────────
  confidenceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  confidenceLabel: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    width: '74px',
    flexShrink: 0,
  },
  barTrack: {
    flex: '1',
    height: '5px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    // width and backgroundColor set via inline style for mount animation
  },
  confidenceValue: {
    fontSize: '12px',
    fontWeight: '600',
    width: '36px',
    textAlign: 'right',
    flexShrink: 0,
  },

  // ── Loading skeleton ────────────────────────────────────────────────────────
  skeletonLine: {
    height: '13px',
    borderRadius: '4px',
    backgroundColor: tokens.colorNeutralBackground4,
    animationName: 'ops-status-pulse',
    animationDuration: '1.8s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  skeletonBlock: {
    height: '80px',
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground4,
    animationName: 'ops-status-pulse',
    animationDuration: '1.8s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },

  // ── Error card ──────────────────────────────────────────────────────────────
  errorCard: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: `0 0 0 1px rgba(220, 38, 38, 0.35), 0 4px 24px rgba(0, 0, 0, 0.3)`,
  },
  errorAccent: {
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '4px',
    backgroundColor: '#dc2626',
    zIndex: 1,
    pointerEvents: 'none',
  },
  errorContent: {
    padding: '20px 20px 20px 24px',
  },
  errorTitle: {
    margin: '0 0 6px 0',
    padding: '0',
    fontSize: '13px',
    fontWeight: '700',
    color: '#f87171',
  },
  errorMessage: {
    margin: '0',
    padding: '0',
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
  },
})

// ── AgentRow ──────────────────────────────────────────────────────────────────

const AgentRow: React.FC<{ activity: AgentActivity; mounted: boolean }> = ({
  activity,
  mounted,
}) => {
  const s = useStyles()
  const cfg = STATUS_CFG[activity.status]
  const Icon = AGENT_ICONS[activity.id]
  const isRunning = activity.status === 'running'

  return (
    <div className={mergeClasses(s.agentCard, isRunning ? s.agentCardRunning : undefined)}>
      {/* Left accent — pulsing when running */}
      <div
        className={s.agentAccent}
        style={
          isRunning
            ? {
                backgroundColor: cfg.accentColor,
                animationName: 'ops-status-pulse',
                animationDuration: '2s',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
              }
            : { backgroundColor: cfg.accentColor }
        }
      />

      <div className={s.agentContent}>
        {/* Header row: icon · name/role · status chip · timestamp */}
        <div className={s.agentHeaderRow}>
          {/* Agent icon */}
          <div
            className={s.agentIconWrap}
            style={{ backgroundColor: AGENT_COLORS[activity.id] }}
          >
            <Icon className={s.agentIcon} />
          </div>

          {/* Name + role */}
          <div className={s.agentInfo}>
            <span className={s.agentName}>{activity.name}</span>
            <span className={s.agentRole}>{activity.role}</span>
          </div>

          {/* Status chip + timestamp */}
          <div className={s.agentMeta}>
            {/* Status chip — all colors via inline style to avoid n×3 makeStyles classes */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 9px',
                border: `1px solid ${cfg.chipBorder}`,
                borderRadius: '20px',
                backgroundColor: cfg.chipBg,
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.8px',
                color: cfg.textColor,
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
              }}
            >
              {isRunning ? (
                <div className={s.spinner} />
              ) : (
                <div
                  style={{
                    width: '5px',
                    height: '5px',
                    minWidth: '5px',
                    borderRadius: '50%',
                    backgroundColor: cfg.dotColor,
                    flexShrink: 0,
                  }}
                />
              )}
              {cfg.label}
            </div>

            <span className={s.timestamp}>{activity.startedAt}</span>
            {activity.durationLabel && (
              <span className={s.durationTag}>{activity.durationLabel}</span>
            )}
          </div>
        </div>

        {/* Divider + Findings */}
        <div className={s.findingsDivider} />
        <p className={mergeClasses(s.findings, isRunning ? s.findingsActive : undefined)}>
          {activity.findings}
        </p>

        {/* Confidence bar */}
        <div className={s.confidenceRow}>
          <span className={s.confidenceLabel}>Confidence</span>
          <div className={s.barTrack}>
            <div
              className={s.barFill}
              style={{
                width: mounted ? `${activity.confidence}%` : '0%',
                backgroundColor: confColor(activity.confidence),
                transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
          <span
            className={s.confidenceValue}
            style={{ color: confColor(activity.confidence) }}
          >
            {activity.confidence}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ── AgentActivityPanel ────────────────────────────────────────────────────────

export const AgentActivityPanel: React.FC = () => {
  const s = useStyles()
  const { data, loading, error } = useAgentActivity('INC-2024-0847')
  const { status: streamStatus, lastEvent } = useIncidentStream('INC-2024-0847')

  // ── Live data — starts as the HTTP snapshot, patched by SSE ────────────────
  const [liveData, setLiveData] = useState<ApiAgentActivityResponse | null>(null)

  useEffect(() => {
    if (data) setLiveData(data)
  }, [data])

  useEffect(() => {
    if (!lastEvent) return
    setLiveData((prev) => {
      if (!prev) return prev

      if (lastEvent.event_type === 'agent.started') {
        return {
          ...prev,
          running: prev.running + 1,
          waiting: Math.max(0, prev.waiting - 1),
          agents: prev.agents.map((a) =>
            a.role === lastEvent.agent_name
              ? { ...a, status: 'running', started_at: lastEvent.timestamp }
              : a,
          ),
        }
      }

      if (lastEvent.event_type === 'agent.finding') {
        const confidence = lastEvent.payload.confidence as number | undefined
        if (confidence === undefined) return prev
        return {
          ...prev,
          agents: prev.agents.map((a) =>
            a.role === lastEvent.agent_name ? { ...a, confidence } : a,
          ),
        }
      }

      if (lastEvent.event_type === 'agent.completed') {
        return {
          ...prev,
          running: Math.max(0, prev.running - 1),
          completed: prev.completed + 1,
          agents: prev.agents.map((a) =>
            a.role === lastEvent.agent_name
              ? { ...a, status: 'completed', completed_at: lastEvent.timestamp }
              : a,
          ),
        }
      }

      return prev
    })
  }, [lastEvent])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.panel} style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={s.skeletonLine} style={{ width: '50%' }} />
            <div className={s.skeletonLine} style={{ width: '35%' }} />
            <div className={s.skeletonBlock} />
            <div className={s.skeletonBlock} />
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error || !liveData) {
    return (
      <div className={s.page}>
        <div className={s.errorCard}>
          <div className={s.errorAccent} />
          <div className={s.errorContent}>
            <p className={s.errorTitle}>Failed to load agent activity</p>
            <p className={s.errorMessage}>{error ?? 'No data available'}</p>
          </div>
        </div>
      </div>
    )
  }

  const activities = liveData.agents.map(mapTask)
  const incidentTitle = 'Checkout Service Failure'

  return (
    <div className={s.page}>
      <div className={s.panel}>
        {/* ── Panel header ─────────────────────────────────────────────── */}
        <div className={s.panelHeader}>
          <div className={s.headerTopRow}>
            <span className={s.panelLabel}>Agent Investigation · {liveData.incident_id}</span>
            <StreamStatusBadge status={streamStatus} />
          </div>

          <p className={s.incidentTitle}>{incidentTitle}</p>

          {/* Summary stats */}
          <div className={s.statsRow}>
            <div className={s.statItem}>
              <span className={s.statValue}>{liveData.total_dispatched}</span>
              <span className={s.statLabel}>Dispatched</span>
            </div>
            <div className={s.statDivider} />
            <div className={s.statItem}>
              <span className={mergeClasses(s.statValue, s.statCompleted)}>{liveData.completed}</span>
              <span className={s.statLabel}>Completed</span>
            </div>
            <div className={s.statDivider} />
            <div className={s.statItem}>
              <span className={mergeClasses(s.statValue, s.statRunning)}>{liveData.running}</span>
              <span className={s.statLabel}>Running</span>
            </div>
            <div className={s.statDivider} />
            <div className={s.statItem}>
              <span className={s.statValue}>{liveData.waiting}</span>
              <span className={s.statLabel}>Waiting</span>
            </div>
          </div>
        </div>

        {/* ── Scrollable agent list ─────────────────────────────────────── */}
        <div className={s.agentList}>
          {activities.map((activity) => (
            <AgentRow key={activity.id} activity={activity} mounted={mounted} />
          ))}
        </div>
      </div>
    </div>
  )
}

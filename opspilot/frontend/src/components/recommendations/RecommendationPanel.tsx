import React, { useState, useEffect } from 'react'
import { makeStyles, tokens, shorthands, Button } from '@fluentui/react-components'
import {
  AlertRegular,
  BotRegular,
  ShieldCheckmarkRegular,
  ArrowTrendingLinesRegular,
} from '@fluentui/react-icons'
import { useRecommendations } from '../../hooks/useRecommendations'
import { useAgentActivity } from '../../hooks/useAgentActivity'
import { useIncidentStream } from '../../hooks/useIncidentStream'
import { StreamStatusBadge } from '../shared/StreamStatusBadge'
import type { ApiRecommendationResponse, ApiRecommendedAction, ApiRootCause } from '../../api/recommendations'

// ── Local types (mirror mock shapes for sub-components) ──────────────────────

type RiskLevel   = 'safe' | 'medium' | 'high' | 'critical'
type ImpactLevel = 'low'  | 'medium' | 'high' | 'critical'

interface RootCauseSummary {
  title: string
  description: string
  confidence: number
  incidentId: string
  affectedServices: string[]
  affectedUsers: number
  hourlyImpact: number
  blastRadius: number
}

interface RecommendedAction {
  id: string
  type: string
  typeLabel: string
  title: string
  description: string
  steps: string[]
  risk: RiskLevel
  riskLabel: string
  impact: ImpactLevel
  impactLabel: string
  estimatedTime: string
  priority: number
}

// ── Mapping helpers ────────────────────────────────────────────────────────────

function mapRootCause(rc: ApiRootCause): RootCauseSummary {
  return {
    title: rc.title,
    description: rc.description,
    confidence: rc.confidence,
    incidentId: rc.incident_id,
    affectedServices: [],   // not returned by backend; display via blast_radius
    affectedUsers: rc.affected_users,
    hourlyImpact: rc.hourly_impact_usd,
    blastRadius: rc.blast_radius,
  }
}

function normaliseRisk(s: string): RiskLevel {
  const valid: RiskLevel[] = ['safe', 'medium', 'high', 'critical']
  return valid.includes(s as RiskLevel) ? (s as RiskLevel) : 'medium'
}

function normaliseImpact(s: string): ImpactLevel {
  const valid: ImpactLevel[] = ['low', 'medium', 'high', 'critical']
  return valid.includes(s as ImpactLevel) ? (s as ImpactLevel) : 'medium'
}

function mapAction(a: ApiRecommendedAction): RecommendedAction {
  return {
    id: a.id,
    type: a.type,
    typeLabel: a.type_label,
    title: a.title,
    description: a.description,
    steps: a.steps,
    risk: normaliseRisk(a.risk),
    riskLabel: a.risk_label,
    impact: normaliseImpact(a.impact),
    impactLabel: a.impact_label,
    estimatedTime: a.estimated_time,
    priority: a.priority,
  }
}

function mapRecommendations(r: ApiRecommendationResponse): {
  rootCause: RootCauseSummary
  actions: RecommendedAction[]
} {
  return {
    rootCause: mapRootCause(r.root_cause),
    actions: r.actions.map(mapAction),
  }
}

// ── Risk & Impact display config ──────────────────────────────────────────────

interface ColorCfg {
  color: string
  bg: string
  border: string
  text: string
}

const RISK_CFG: Record<RiskLevel, ColorCfg> = {
  safe: {
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.35)',
    text: '#4ade80',
  },
  medium: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.35)',
    text: '#fbbf24',
  },
  high: {
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.1)',
    border: 'rgba(249, 115, 22, 0.35)',
    text: '#fb923c',
  },
  critical: {
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.1)',
    border: 'rgba(220, 38, 38, 0.4)',
    text: '#f87171',
  },
}

const IMPACT_CFG: Record<ImpactLevel, ColorCfg> = {
  critical: { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)',   border: 'rgba(220, 38, 38, 0.35)',  text: '#f87171' },
  high:     { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)',  border: 'rgba(249, 115, 22, 0.35)', text: '#fb923c' },
  medium:   { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)',  border: 'rgba(245, 158, 11, 0.35)', text: '#fbbf24' },
  low:      { color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.3)', text: '#94a3b8' },
}

// ── KPI config builder ────────────────────────────────────────────────────────

interface KpiCfg {
  id: string
  label: string
  target: number
  format: (n: number) => string
  color: string
  bg: string
  border: string
  text: string
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  animDuration: number
  subtitle: string
}

function buildKpiData(
  incidentCount: number,
  agentCount: number,
  confidence: number,
  hourlyImpact: number,
): KpiCfg[] {
  return [
    {
      id: 'open_incidents',
      label: 'Open Incidents',
      target: incidentCount,
      format: (n) => String(n),
      color: '#dc2626',
      bg: 'rgba(220, 38, 38, 0.12)',
      border: 'rgba(220, 38, 38, 0.3)',
      text: '#f87171',
      icon: AlertRegular,
      animDuration: 500,
      subtitle: 'P1 CRITICAL',
    },
    {
      id: 'agents_active',
      label: 'Agents Active',
      target: agentCount,
      format: (n) => String(n),
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
      text: '#60a5fa',
      icon: BotRegular,
      animDuration: 700,
      subtitle: 'IN INVESTIGATION',
    },
    {
      id: 'rc_confidence',
      label: 'Root Cause Confidence',
      target: Math.round(confidence),
      format: (n) => `${n}%`,
      color: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.3)',
      text: '#4ade80',
      icon: ShieldCheckmarkRegular,
      animDuration: 1000,
      subtitle: 'CONFIRMED',
    },
    {
      id: 'business_impact',
      label: 'Business Impact',
      target: Math.round(hourlyImpact),
      format: (n) => `$${n.toLocaleString()}`,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      text: '#fbbf24',
      icon: ArrowTrendingLinesRegular,
      animDuration: 1400,
      subtitle: 'PER HOUR',
    },
  ]
}

// ── Animated counter hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration: number, start: boolean): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!start) { setVal(0); return }
    let raf: number
    const t0 = performance.now()
    const tick = (now: number) => {
      const elapsed = now - t0
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [start, target, duration])
  return val
}

const confColor = (c: number): string => {
  if (c >= 90) return '#4ade80'
  if (c >= 75) return '#3b82f6'
  return '#f59e0b'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  page: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  // ── Shared ──────────────────────────────────────────────────────────────────
  card: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: `0 0 0 1px ${tokens.colorNeutralStroke1}, 0 4px 20px rgba(0, 0, 0, 0.25)`,
  },
  accent: {
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '4px',
    zIndex: 1,
    pointerEvents: 'none',
  },
  sep: {
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
  },
  barTrack: {
    flex: '1',
    height: '6px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
  },

  // ── KPI row ──────────────────────────────────────────────────────────────────
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  kpiCard: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    overflow: 'hidden',
    padding: '20px 20px 22px',
    cursor: 'default',
    boxShadow: `0 0 0 1px ${tokens.colorNeutralStroke1}, 0 4px 16px rgba(0, 0, 0, 0.2)`,
    ':hover': {
      transform: 'translateY(-3px)',
      boxShadow: `0 0 0 1px ${tokens.colorNeutralStroke2}, 0 12px 32px rgba(0, 0, 0, 0.38)`,
    },
  },
  kpiIconWrap: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px',
  },
  kpiValue: {
    fontSize: '36px',
    fontWeight: '700',
    letterSpacing: '-1.5px',
    lineHeight: '1',
    marginBottom: '5px',
  },
  kpiLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginBottom: '10px',
  },
  kpiSubtitle: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.7px',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  kpiBottomBar: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    height: '2px',
  },

  // ── Root cause card ──────────────────────────────────────────────────────────
  rcContent: {
    padding: '20px 24px 20px 28px',
  },
  rcHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  rcChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '4px 12px 4px 9px',
    ...shorthands.border('1px', 'solid', 'rgba(220, 38, 38, 0.4)'),
    borderRadius: '20px',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  rcDot: {
    width: '7px',
    height: '7px',
    minWidth: '7px',
    borderRadius: '50%',
    backgroundColor: '#dc2626',
  },
  rcChipText: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.8px',
    color: '#f87171',
  },
  rcIncidentId: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
  },
  rcTitle: {
    margin: '0 0 8px 0',
    padding: '0',
    fontSize: '20px',
    fontWeight: '700',
    color: tokens.colorNeutralForeground1,
    letterSpacing: '-0.3px',
    lineHeight: '1.3',
  },
  rcDesc: {
    margin: '0',
    padding: '0',
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.6',
  },
  rcConfRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginTop: '14px',
    marginBottom: '12px',
  },
  rcConfLabel: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    width: '120px',
    flexShrink: 0,
  },
  rcConfValue: {
    fontSize: '16px',
    fontWeight: '700',
    width: '44px',
    textAlign: 'right',
    flexShrink: 0,
  },
  rcMetrics: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  rcMetricItem: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
  },
  rcMetricSep: {
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    backgroundColor: tokens.colorNeutralStroke2,
    flexShrink: 0,
  },

  // ── Actions section header ────────────────────────────────────────────────────
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
  },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    borderRadius: '20px',
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: '11px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground2,
  },

  // ── 3-column actions grid ────────────────────────────────────────────────────
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },

  // ── Action card internals ────────────────────────────────────────────────────
  actionContent: {
    padding: '16px 16px 16px 20px',
    display: 'flex',
    flexDirection: 'column',
    flex: '1',
  },
  actionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  actionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  // borderColor + color supplied via inline style for risk-based theming
  priorityBadge: {
    ...shorthands.border('1.5px', 'solid', 'transparent'),
    width: '20px',
    height: '20px',
    minWidth: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '700',
    flexShrink: 0,
  },
  typeBadge: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
  },
  actionTitle: {
    margin: '0 0 6px 0',
    padding: '0',
    fontSize: '14px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.3',
  },
  actionDesc: {
    margin: '0',
    padding: '0',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.6',
  },
  stepsList: {
    listStyleType: 'none',
    padding: '0',
    margin: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '7px',
  },
  stepArrow: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
    marginTop: '2px',
    lineHeight: '1.5',
  },
  stepText: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.5',
  },
  actionFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    flexWrap: 'wrap',
  },
  actionFooterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  timeLabel: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    flexShrink: 0,
  },

  // ── Loading skeleton ────────────────────────────────────────────────────────
  skeletonLine: {
    height: '14px',
    borderRadius: '4px',
    backgroundColor: tokens.colorNeutralBackground4,
    animationName: 'ops-status-pulse',
    animationDuration: '1.8s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  skeletonBlock: {
    height: '80px',
    borderRadius: '8px',
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

// ── KpiCard ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{ cfg: KpiCfg; mounted: boolean }> = ({ cfg, mounted }) => {
  const s = useStyles()
  const val = useCountUp(cfg.target, cfg.animDuration, mounted)
  const Icon = cfg.icon
  return (
    <div
      className={s.kpiCard}
      style={{ transition: 'transform 180ms ease, box-shadow 180ms ease' }}
    >
      <div
        className={s.kpiIconWrap}
        style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <Icon style={{ fontSize: '18px', color: cfg.color }} />
      </div>
      <div className={s.kpiValue} style={{ color: cfg.color }}>
        {cfg.format(val)}
      </div>
      <div className={s.kpiLabel}>{cfg.label}</div>
      <div
        className={s.kpiSubtitle}
        style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
      >
        {cfg.subtitle}
      </div>
      <div className={s.kpiBottomBar} style={{ backgroundColor: cfg.color }} />
    </div>
  )
}

// ── RootCauseCard ─────────────────────────────────────────────────────────────

const RootCauseCard: React.FC<{
  rootCause: RootCauseSummary
  mounted: boolean
  streamStatus: import('../../hooks/useIncidentStream').ConnectionStatus
}> = ({
  rootCause,
  mounted,
  streamStatus,
}) => {
  const s = useStyles()
  return (
    <div className={s.card}>
      <div className={s.accent} style={{ backgroundColor: '#dc2626' }} />
      <div className={s.rcContent}>
        {/* Status chip + incident ID + stream badge */}
        <div className={s.rcHeaderRow}>
          <div className={s.rcChip}>
            <div className={s.rcDot} />
            <span className={s.rcChipText}>ROOT CAUSE CONFIRMED</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StreamStatusBadge status={streamStatus} />
            <span className={s.rcIncidentId}>{rootCause.incidentId}</span>
          </div>
        </div>

        {/* Title + description */}
        <h2 className={s.rcTitle}>{rootCause.title}</h2>
        <p className={s.rcDesc}>{rootCause.description}</p>

        {/* Confidence bar */}
        <div className={s.sep} style={{ marginTop: '16px' }} />
        <div className={s.rcConfRow}>
          <span className={s.rcConfLabel}>Confidence Score</span>
          <div className={s.barTrack}>
            <div
              className={s.barFill}
              style={{
                width: mounted ? `${rootCause.confidence}%` : '0%',
                backgroundColor: confColor(rootCause.confidence),
                transition: 'width 1.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
          <span
            className={s.rcConfValue}
            style={{ color: confColor(rootCause.confidence) }}
          >
            {rootCause.confidence}%
          </span>
        </div>

        {/* Blast radius + users + business impact */}
        <div className={s.sep} style={{ marginBottom: '12px' }} />
        <div className={s.rcMetrics}>
          <span className={s.rcMetricItem}>{rootCause.blastRadius} services affected</span>
          <div className={s.rcMetricSep} />
          <span className={s.rcMetricItem}>
            ~{(rootCause.affectedUsers / 1000).toFixed(0)}K users impacted
          </span>
          <div className={s.rcMetricSep} />
          <span className={s.rcMetricItem} style={{ color: '#f87171', fontWeight: '600' }}>
            ${rootCause.hourlyImpact.toLocaleString()} / hour
          </span>
        </div>
      </div>
    </div>
  )
}

// ── ActionCard ────────────────────────────────────────────────────────────────

const ACTION_CTA: Record<string, string> = {
  rollback:       'Execute Rollback',
  fix:            'Apply Hotfix',
  infrastructure: 'Scale Infra',
}

const ActionCard: React.FC<{ action: RecommendedAction; mounted: boolean }> = ({
  action,
  mounted: _mounted,
}) => {
  const s = useStyles()
  const risk   = RISK_CFG[action.risk]
  const impact = IMPACT_CFG[action.impact]

  // CTA visual hierarchy: primary = safest/highest priority
  const btnAppearance =
    action.priority === 1 ? 'primary' : action.priority === 2 ? 'secondary' : 'subtle'

  return (
    <div
      className={s.card}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: action.risk === 'safe' ? 'rgba(34, 197, 94, 0.03)' : undefined,
      }}
    >
      <div className={s.accent} style={{ backgroundColor: risk.color }} />
      <div className={s.actionContent}>
        {/* Header: priority circle + type + risk chip */}
        <div className={s.actionHeaderRow}>
          <div className={s.actionHeaderLeft}>
            <div
              className={s.priorityBadge}
              style={{ borderColor: risk.color, color: risk.text }}
            >
              {action.priority}
            </div>
            <span className={s.typeBadge}>{action.typeLabel.toUpperCase()}</span>
          </div>

          {/* Risk level chip — inline styles for dynamic color */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 9px',
              border: `1px solid ${risk.border}`,
              borderRadius: '20px',
              backgroundColor: risk.bg,
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.8px',
              color: risk.text,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '5px',
                height: '5px',
                minWidth: '5px',
                borderRadius: '50%',
                backgroundColor: risk.color,
              }}
            />
            {action.riskLabel.toUpperCase()}
          </div>
        </div>

        {/* Title + description */}
        <h3 className={s.actionTitle}>{action.title}</h3>
        <p className={s.actionDesc}>{action.description}</p>

        {/* Steps */}
        <div className={s.sep} style={{ marginTop: '12px', marginBottom: '10px' }} />
        <ul className={s.stepsList}>
          {action.steps.map((step, i) => (
            <li key={i} className={s.stepItem}>
              <span className={s.stepArrow}>→</span>
              <span className={s.stepText}>{step}</span>
            </li>
          ))}
        </ul>

        {/* Footer — auto top margin pushes it to card bottom */}
        <div className={s.sep} style={{ marginTop: 'auto', marginBottom: '10px' }} />
        <div className={s.actionFooter}>
          <div className={s.actionFooterLeft}>
            {/* Impact level badge */}
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
                color: impact.text,
                backgroundColor: impact.bg,
                border: `1px solid ${impact.border}`,
                borderRadius: '4px',
                padding: '2px 7px',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {action.impactLabel.toUpperCase()}
            </span>
            <span className={s.timeLabel}>{action.estimatedTime}</span>
          </div>

          <Button appearance={btnAppearance} size="small">
            {ACTION_CTA[action.type]}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── RecommendationPanel ───────────────────────────────────────────────────────

export const RecommendationPanel: React.FC = () => {
  const s = useStyles()
  const recState   = useRecommendations('INC-2024-0847')
  const agentState = useAgentActivity('INC-2024-0847')
  const { status: streamStatus, lastEvent } = useIncidentStream('INC-2024-0847')

  // Live confidence — starts from HTTP data, updated by SSE root_cause.updated
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null)

  useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.event_type === 'root_cause.updated') {
      const confidence = lastEvent.payload.confidence as number | undefined
      if (typeof confidence === 'number') setLiveConfidence(confidence)
    }
  }, [lastEvent])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (recState.loading) {
    return (
      <div className={s.page}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={s.skeletonBlock} />
          ))}
        </div>
        <div className={s.skeletonBlock} style={{ marginTop: '0' }} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
          }}
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className={s.skeletonBlock} />
          ))}
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (recState.error || !recState.data) {
    return (
      <div className={s.page}>
        <div className={s.errorCard}>
          <div className={s.errorAccent} />
          <div className={s.errorContent}>
            <p className={s.errorTitle}>Failed to load dashboard data</p>
            <p className={s.errorMessage}>{recState.error ?? 'No data available'}</p>
          </div>
        </div>
      </div>
    )
  }

  const { rootCause: rcBase, actions } = mapRecommendations(recState.data)
  // Apply SSE-updated confidence if available
  const rootCause: RootCauseSummary = liveConfidence !== null
    ? { ...rcBase, confidence: liveConfidence }
    : rcBase

  const kpiData = buildKpiData(
    1,
    agentState.data?.total_dispatched ?? 5,
    rootCause.confidence,
    rootCause.hourlyImpact,
  )

  return (
    <div className={s.page}>
      <div className={s.kpiGrid}>
        {kpiData.map((cfg) => (
          <KpiCard key={cfg.id} cfg={cfg} mounted={mounted} />
        ))}
      </div>

      <RootCauseCard rootCause={rootCause} mounted={mounted} streamStatus={streamStatus} />

      <div className={s.sectionHeader}>
        <span className={s.sectionLabel}>Recommended Actions</span>
        <div className={s.countBadge}>{actions.length} actions</div>
      </div>

      <div className={s.actionsGrid}>
        {actions.map((action) => (
          <ActionCard key={action.id} action={action} mounted={mounted} />
        ))}
      </div>
    </div>
  )
}

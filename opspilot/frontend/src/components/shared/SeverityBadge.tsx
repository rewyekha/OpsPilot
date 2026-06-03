/**
 * Token-driven badges shared across the console.
 *
 * Replaces the dozens of inline `<div style={{ background: rgba(...) }}>` chips
 * that were copy-pasted into every panel. All colors come from theme/tokens,
 * so severity/risk/impact/status chips look identical everywhere.
 */
import React from 'react'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import {
  AGENT_STATUS_COLORS,
  PRIORITY_SEVERITY,
  RISK_COLORS,
  IMPACT_COLORS,
  SEVERITY_COLORS,
  LIFECYCLE_COLORS,
  LIFECYCLE_LABELS,
  asAgentStatus,
  asImpact,
  asRisk,
  asLifecycle,
  type ColorCfg,
} from '../../theme/tokens'

const useStyles = makeStyles({
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '20px',
    paddingLeft: '8px',
    paddingRight: '8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  pill: { borderRadius: '20px', paddingLeft: '9px' },
  dot: { width: '6px', height: '6px', minWidth: '6px', borderRadius: '50%' },
})

interface BaseChipProps {
  cfg: ColorCfg
  label: string
  pill?: boolean
  dot?: boolean
}

const Chip: React.FC<BaseChipProps> = ({ cfg, label, pill, dot }) => {
  const s = useStyles()
  return (
    <span
      className={mergeClasses(s.chip, pill && s.pill)}
      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      {dot && <span className={s.dot} style={{ backgroundColor: cfg.color }} />}
      {label.toUpperCase()}
    </span>
  )
}

/** Incident severity (P0–P3). */
export const SeverityBadge: React.FC<{ severity: string; pill?: boolean }> = ({
  severity,
  pill,
}) => {
  const key = PRIORITY_SEVERITY[severity] ?? 'info'
  return <Chip cfg={SEVERITY_COLORS[key]} label={severity} pill={pill} dot />
}

/** Agent execution status (completed/running/waiting/…). */
export const AgentStatusBadge: React.FC<{ status: string; pill?: boolean }> = ({
  status,
  pill,
}) => {
  const key = asAgentStatus(status)
  return <Chip cfg={AGENT_STATUS_COLORS[key]} label={status} pill={pill} dot />
}

/** Remediation risk level. */
export const RiskBadge: React.FC<{ risk: string; label?: string; pill?: boolean }> = ({
  risk,
  label,
  pill = true,
}) => <Chip cfg={RISK_COLORS[asRisk(risk)]} label={label ?? risk} pill={pill} dot />

/** Business impact level. */
export const ImpactBadge: React.FC<{ impact: string; label?: string }> = ({ impact, label }) => (
  <Chip cfg={IMPACT_COLORS[asImpact(impact)]} label={label ?? impact} />
)

/** Incident lifecycle status (investigating → … → closed). */
export const IncidentStatusBadge: React.FC<{ status: string; pill?: boolean }> = ({
  status,
  pill = true,
}) => {
  const key = asLifecycle(status)
  return <Chip cfg={LIFECYCLE_COLORS[key]} label={LIFECYCLE_LABELS[key]} pill={pill} dot />
}

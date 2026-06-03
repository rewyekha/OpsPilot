/**
 * Shared semantic color tokens.
 *
 * Before this file, every panel (RecommendationPanel, AgentActivityPanel,
 * InvestigationTimelinePanel, NavBar, …) re-declared its own RISK_CFG /
 * IMPACT_CFG / SEV_CFG / status-color objects with copy-pasted rgba values.
 * This is the single source of truth for those scales so the enterprise
 * surfaces stay visually consistent and edits happen in one place.
 *
 * These intentionally sit alongside Fluent's design tokens (`tokens.*`): the
 * Fluent ramp drives surfaces/typography/borders; this file drives the
 * domain-semantic accents (severity, risk, impact, agent status, event type)
 * that Fluent does not model.
 */

export interface ColorCfg {
  /** Solid accent (dots, bars, left-rails). */
  color: string
  /** Translucent fill for chips/badges. */
  bg: string
  /** Chip/badge border. */
  border: string
  /** Readable foreground text on the dark theme. */
  text: string
}

const cfg = (color: string, text: string, alpha = 0.12, borderAlpha = 0.35): ColorCfg => {
  // Expand #rrggbb → rgba(r,g,b,a)
  const r = Number.parseInt(color.slice(1, 3), 16)
  const g = Number.parseInt(color.slice(3, 5), 16)
  const b = Number.parseInt(color.slice(5, 7), 16)
  return {
    color,
    text,
    bg: `rgba(${r}, ${g}, ${b}, ${alpha})`,
    border: `rgba(${r}, ${g}, ${b}, ${borderAlpha})`,
  }
}

// ── Severity (incident / notification) ───────────────────────────────────────
export type SeverityKey = 'critical' | 'warning' | 'info' | 'success'

export const SEVERITY_COLORS: Record<SeverityKey, ColorCfg> = {
  critical: cfg('#dc2626', '#f87171'),
  warning: cfg('#f59e0b', '#fbbf24'),
  info: cfg('#3b82f6', '#60a5fa'),
  success: cfg('#22c55e', '#4ade80'),
}

/** Maps incident priority labels (P0–P3) onto the severity scale. */
export const PRIORITY_SEVERITY: Record<string, SeverityKey> = {
  P0: 'critical',
  P1: 'critical',
  P2: 'warning',
  P3: 'info',
}

// ── Remediation risk ──────────────────────────────────────────────────────────
export type RiskKey = 'safe' | 'medium' | 'high' | 'critical'

export const RISK_COLORS: Record<RiskKey, ColorCfg> = {
  safe: cfg('#22c55e', '#4ade80', 0.1),
  medium: cfg('#f59e0b', '#fbbf24', 0.1),
  high: cfg('#f97316', '#fb923c', 0.1),
  critical: cfg('#dc2626', '#f87171', 0.1, 0.4),
}

// ── Business impact ────────────────────────────────────────────────────────────
export type ImpactKey = 'low' | 'medium' | 'high' | 'critical'

export const IMPACT_COLORS: Record<ImpactKey, ColorCfg> = {
  low: cfg('#64748b', '#94a3b8', 0.1, 0.3),
  medium: cfg('#f59e0b', '#fbbf24', 0.1),
  high: cfg('#f97316', '#fb923c', 0.1),
  critical: cfg('#dc2626', '#f87171', 0.1),
}

// ── Agent execution status ────────────────────────────────────────────────────
export type AgentStatusKey = 'completed' | 'running' | 'waiting' | 'failed' | 'pending'

export const AGENT_STATUS_COLORS: Record<AgentStatusKey, ColorCfg> = {
  completed: cfg('#22c55e', '#4ade80'),
  running: cfg('#3b82f6', '#60a5fa'),
  waiting: cfg('#64748b', '#94a3b8', 0.12, 0.3),
  pending: cfg('#64748b', '#94a3b8', 0.12, 0.3),
  failed: cfg('#dc2626', '#f87171'),
}

// ── Incident lifecycle ────────────────────────────────────────────────────────
export type LifecycleKey =
  | 'investigating'
  | 'mitigating'
  | 'monitoring'
  | 'resolved'
  | 'closed'

export const LIFECYCLE_ORDER: LifecycleKey[] = [
  'investigating',
  'mitigating',
  'monitoring',
  'resolved',
  'closed',
]

export const LIFECYCLE_COLORS: Record<LifecycleKey, ColorCfg> = {
  investigating: cfg('#3b82f6', '#60a5fa'),
  mitigating: cfg('#f59e0b', '#fbbf24'),
  monitoring: cfg('#8b5cf6', '#a78bfa'),
  resolved: cfg('#22c55e', '#4ade80'),
  closed: cfg('#64748b', '#94a3b8', 0.12, 0.3),
}

export const LIFECYCLE_LABELS: Record<LifecycleKey, string> = {
  investigating: 'Investigating',
  mitigating: 'Mitigating',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const asLifecycle = (s: string): LifecycleKey =>
  LIFECYCLE_ORDER.includes(s as LifecycleKey) ? (s as LifecycleKey) : 'investigating'

// ── Timeline event type ───────────────────────────────────────────────────────
export type TimelineTypeKey =
  | 'deployment'
  | 'incident'
  | 'detection'
  | 'correlation'
  | 'root_cause'

export const TIMELINE_TYPE_COLORS: Record<TimelineTypeKey, ColorCfg> = {
  deployment: cfg('#d97706', '#fbbf24'),
  incident: cfg('#dc2626', '#f87171'),
  detection: cfg('#2563eb', '#60a5fa'),
  correlation: cfg('#7c3aed', '#a78bfa'),
  root_cause: cfg('#eab308', '#facc15'),
}

// ── Confidence ────────────────────────────────────────────────────────────────

/** Solid accent color for a confidence score expressed 0–100. */
export function confidenceColor(score: number): string {
  if (score >= 90) return '#4ade80'
  if (score >= 75) return '#3b82f6'
  if (score >= 50) return '#f59e0b'
  return '#f87171'
}

// ── Safe lookups (normalise arbitrary backend strings) ────────────────────────

export const asRisk = (s: string): RiskKey =>
  (['safe', 'medium', 'high', 'critical'] as RiskKey[]).includes(s as RiskKey)
    ? (s as RiskKey)
    : 'medium'

export const asImpact = (s: string): ImpactKey =>
  (['low', 'medium', 'high', 'critical'] as ImpactKey[]).includes(s as ImpactKey)
    ? (s as ImpactKey)
    : 'medium'

export const asAgentStatus = (s: string): AgentStatusKey =>
  (['completed', 'running', 'waiting', 'failed', 'pending'] as AgentStatusKey[]).includes(
    s as AgentStatusKey,
  )
    ? (s as AgentStatusKey)
    : 'pending'

/**
 * Incident export / report generation (client-side, no backend).
 *
 * Builds a snapshot of the current incident from the data already loaded in the
 * app and serialises it to JSON or Markdown. Used by the command bar's
 * "Export Incident" (JSON) and "Generate Report" (Markdown) actions.
 *
 * This is the minimal, real implementation that keeps those buttons functional;
 * the richer sectioned Report drawer (copy / multi-format) is a later phase.
 */
import type { ApiIncidentRecord } from '../api/incidents'
import type { ApiRootCause, ApiRecommendedAction } from '../api/recommendations'
import type { ApiAgentTask } from '../api/agents'
import type { ActionJob, SessionTimelineEvent } from '../store/SessionContext'

export interface SnapshotInput {
  incidentId: string
  status?: string
  incident?: ApiIncidentRecord | null
  rootCause?: ApiRootCause | null
  actions?: ApiRecommendedAction[]
  agents?: ApiAgentTask[]
  jobs?: ActionJob[]
  sessionEvents?: SessionTimelineEvent[]
  generatedAt: string
}

/** Plain serialisable object — the JSON export payload. */
export function buildSnapshot(input: SnapshotInput) {
  return {
    incident_id: input.incidentId,
    status: input.status ?? null,
    generated_at: input.generatedAt,
    incident: input.incident ?? null,
    root_cause: input.rootCause ?? null,
    recommendations: input.actions ?? [],
    actions_taken: input.jobs ?? [],
    agents: input.agents ?? [],
    operator_activity: input.sessionEvents ?? [],
  }
}

/** Structured Markdown report: Exec Summary, Timeline, Root Cause, Evidence, Recommendations, Impact. */
export function snapshotToMarkdown(input: SnapshotInput): string {
  const { incident, rootCause, actions = [], agents = [], jobs = [], sessionEvents = [] } = input
  const L: string[] = []

  L.push(`# Incident Report — ${input.incidentId}`)
  L.push('')
  L.push(`_Generated ${input.generatedAt}_`)
  L.push('')

  // Executive Summary
  L.push('## Executive Summary')
  if (rootCause) {
    L.push(
      `${rootCause.title} — ${rootCause.description} ` +
        `Confidence ${Math.round(rootCause.confidence)}%. ` +
        `Blast radius ${rootCause.blast_radius} service(s), ~${rootCause.affected_users.toLocaleString()} users, ` +
        `$${Math.round(rootCause.hourly_impact_usd).toLocaleString()}/hr impact.`,
    )
  } else {
    L.push('_No root cause available._')
  }
  L.push('')

  // Root Cause
  L.push('## Root Cause')
  if (rootCause) {
    L.push(`- **${rootCause.title}**`)
    L.push(`- ${rootCause.description}`)
    L.push(`- Confidence: ${Math.round(rootCause.confidence)}%`)
  } else {
    L.push('_Not available._')
  }
  L.push('')

  // Evidence (per agent)
  L.push('## Evidence')
  if (agents.length) {
    for (const a of agents) {
      L.push(`### ${a.role_label} (${Math.round(a.confidence)}%)`)
      L.push(a.finding)
      for (const ev of a.evidence) L.push(`- ${ev}`)
      L.push('')
    }
  } else {
    L.push('_No agent findings available._')
    L.push('')
  }

  // Recommendations
  L.push('## Recommendations')
  if (actions.length) {
    for (const r of [...actions].sort((x, y) => x.priority - y.priority)) {
      L.push(`${r.priority}. **${r.title}** (${r.type_label}, ${r.risk_label}, ETA ${r.estimated_time})`)
      L.push(`   - ${r.description}`)
      for (const step of r.steps) L.push(`   - ${step}`)
    }
  } else {
    L.push('_No recommendations available._')
  }
  L.push('')

  // Actions Taken (executed remediation jobs)
  L.push('## Actions Taken')
  if (jobs.length) {
    for (const j of jobs) {
      L.push(`- **${j.actionTitle}** (${j.actionType}) — ${j.status}, job ${j.jobId}`)
    }
  } else {
    L.push('_No remediation actions executed this session._')
  }
  L.push('')

  // Impact Analysis
  L.push('## Impact Analysis')
  if (rootCause) {
    L.push(`- Services affected: ${rootCause.blast_radius}`)
    L.push(`- Users impacted: ~${rootCause.affected_users.toLocaleString()}`)
    L.push(`- Estimated cost: $${Math.round(rootCause.hourly_impact_usd).toLocaleString()}/hr`)
  }
  if (incident) {
    L.push(`- Severity: ${incident.severity}`)
    L.push(`- Status: ${incident.status}`)
  }
  L.push('')

  // Timeline (operator activity captured this session)
  L.push('## Timeline (Operator Activity)')
  if (sessionEvents.length) {
    for (const e of sessionEvents) {
      L.push(`- \`${e.timestamp}\` — **${e.title}**: ${e.description}`)
    }
  } else {
    L.push('_No operator actions recorded this session._')
  }
  L.push('')

  return L.join('\n')
}

/** A concise executive summary paragraph (for copy / quick share). */
export function executiveSummary(input: SnapshotInput): string {
  const { incident, rootCause, actions = [], agents = [] } = input
  const parts: string[] = []
  parts.push(`Incident ${input.incidentId}${input.status ? ` (${input.status})` : ''}.`)
  if (incident) parts.push(`Severity ${incident.severity}.`)
  if (rootCause) {
    parts.push(
      `Root cause: ${rootCause.title} — ${rootCause.description} ` +
        `Confidence ${Math.round(rootCause.confidence)}%, blast radius ${rootCause.blast_radius} service(s), ` +
        `~${rootCause.affected_users.toLocaleString()} users, ` +
        `$${Math.round(rootCause.hourly_impact_usd).toLocaleString()}/hr impact.`,
    )
  }
  if (agents.length) parts.push(`${agents.length} agents engaged.`)
  if (actions.length) {
    const top = [...actions].sort((a, b) => a.priority - b.priority)[0]
    parts.push(`Recommended action: ${top.title} (${top.type_label}, ${top.risk_label}).`)
  }
  return parts.join(' ')
}

/** Trigger a browser download of in-memory content. */
export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * AgentBlade — the "Open Agent" modal.
 *
 * Opened from an agent row's single action. Holds the agent's execution detail
 * (status, confidence, execution logs, evidence) with the agent action (re-run)
 * in the footer.
 */
import React from 'react'
import { makeStyles, tokens, Button } from '@fluentui/react-components'
import { ArrowSyncRegular } from '@fluentui/react-icons'
import { BladeModal, BladeSection } from '../shared/BladeModal'
import { ConfidenceBar } from '../shared/ConfidenceBar'
import { AgentStatusBadge } from '../shared/SeverityBadge'
import { useNotify } from '../../store/NotificationContext'
import { useFormatters } from '../../store/PreferencesContext'
import { formatDuration } from '../../utils/formatters'

/** Minimal shape an agent execution needs to render in the blade — satisfied by
 *  both the live ApiAgentTask and a persisted AgentExecution record. */
export interface AgentLike {
  role: string
  role_label: string
  status: string
  confidence: number
  duration_seconds?: number | null
  finding?: string
  evidence?: string[]
  started_at?: string
  completed_at?: string
  incident_id?: string
  tools_called?: string[]
}

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' },
  kpi: { display: 'flex', flexDirection: 'column', gap: '3px' },
  kpiLabel: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  kpiValue: { fontSize: '15px', fontWeight: 700, color: tokens.colorNeutralForeground1 },
  text: { fontSize: '12px', color: tokens.colorNeutralForeground2, lineHeight: 1.5 },
  log: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontFamily: '"Cascadia Code","Consolas",monospace',
    fontSize: '11px',
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
    overflowX: 'auto',
  },
  list: { listStyleType: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' },
  li: { fontSize: '12px', color: tokens.colorNeutralForeground2, lineHeight: 1.5 },
  muted: { fontSize: '12px', color: tokens.colorNeutralForeground4 },
})

export const AgentBlade: React.FC<{ agent: AgentLike | null; open: boolean; onClose: () => void }> = ({
  agent,
  open,
  onClose,
}) => {
  const s = useStyles()
  const notify = useNotify()
  const fmt = useFormatters()

  if (!agent) return null

  const rerun = () => {
    window.dispatchEvent(new CustomEvent('opspilot:refresh'))
    notify({ title: 'Re-running agent', body: `${agent.role_label} re-dispatched.`, intent: 'info' })
  }

  // Build a readable execution log from the tools the agent invoked.
  const execLog = [
    `[${agent.role}] status=${agent.status} confidence=${Math.round(agent.confidence)}%`,
    ...(agent.tools_called ?? []).map((t, i) => `  ${i + 1}. invoked ${t}`),
    agent.duration_seconds ? `[done] in ${formatDuration(agent.duration_seconds)}` : '[running]',
  ].join('\n')

  return (
    <BladeModal
      open={open}
      onClose={onClose}
      title={agent.role_label}
      subtitle={agent.incident_id ? `${agent.role} · ${agent.incident_id}` : agent.role}
      headerBadge={<AgentStatusBadge status={agent.status} />}
      actions={<Button appearance="primary" size="small" icon={<ArrowSyncRegular />} onClick={rerun}>Re-run</Button>}
    >
      <BladeSection label="Details">
        <div className={s.kpis}>
          <div className={s.kpi}><span className={s.kpiLabel}>Confidence</span><span className={s.kpiValue}>{Math.round(agent.confidence)}%</span></div>
          <div className={s.kpi}><span className={s.kpiLabel}>Exec Time</span><span className={s.kpiValue}>{agent.duration_seconds ? formatDuration(agent.duration_seconds) : '—'}</span></div>
          <div className={s.kpi}><span className={s.kpiLabel}>Started</span><span className={s.kpiValue}>{agent.started_at ? fmt.time(agent.started_at) : '—'}</span></div>
          <div className={s.kpi}><span className={s.kpiLabel}>Completed</span><span className={s.kpiValue}>{agent.completed_at ? fmt.time(agent.completed_at) : '—'}</span></div>
        </div>
        <div style={{ marginTop: 10 }}><ConfidenceBar value={agent.confidence} /></div>
        {agent.finding && <div className={s.text} style={{ marginTop: 10 }}>{agent.finding}</div>}
      </BladeSection>

      <BladeSection label="Execution Logs">
        <pre className={s.log}>{execLog}</pre>
      </BladeSection>

      <BladeSection label="Evidence">
        {(agent.evidence?.length ?? 0) === 0 ? <span className={s.muted}>No evidence captured.</span> : (
          <ul className={s.list}>{(agent.evidence ?? []).map((e, i) => <li key={i} className={s.li}>• {e}</li>)}</ul>
        )}
      </BladeSection>
    </BladeModal>
  )
}

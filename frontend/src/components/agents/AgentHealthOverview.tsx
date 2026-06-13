/**
 * AgentHealthOverview — per-agent execution stats computed from real completed
 * investigations (GET /api/agents/stats), plus a fleet summary. Every value —
 * execution count, average duration, average confidence, last execution, success
 * rate — comes from the persisted investigation store. No hardcoded percentages.
 * Rows open the agent's latest real execution in the AgentBlade.
 */
import React, { useMemo, useState } from 'react'
import {
  makeStyles, tokens, Table, TableHeader, TableHeaderCell, TableRow, TableBody,
  TableCell, TableCellLayout, Spinner, Tooltip,
} from '@fluentui/react-components'
import { BotRegular, InfoRegular } from '@fluentui/react-icons'
import { useAgentStats } from '../../hooks/useInsights'
import { useLatestInvestigation } from '../../hooks/useInsights'
import { AgentBlade, type AgentLike } from './AgentBlade'
import { EmptyState } from '../shared/EmptyState'
import { confidenceColor } from '../../theme/tokens'
import { formatDuration } from '../../utils/formatters'
import { AGENT_DESCRIPTIONS } from '../../utils/constants'
import { useFormatters } from '../../store/PreferencesContext'

const useStyles = makeStyles({
  page: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  sectionLabel: { fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' },
  stat: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  statLabel: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  statValue: { fontSize: '22px', fontWeight: 700, color: tokens.colorNeutralForeground1, letterSpacing: '-0.4px' },
  card: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px', overflow: 'hidden' },
  row: { cursor: 'pointer', ':hover': { backgroundColor: tokens.colorNeutralBackground3 } },
  agentName: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  info: { fontSize: '14px', color: tokens.colorNeutralForeground4, cursor: 'help', flexShrink: 0, ':hover': { color: tokens.colorNeutralForeground2 } },
  num: { fontVariantNumeric: 'tabular-nums' },
  center: { display: 'flex', justifyContent: 'center', padding: '32px' },
})

export const AgentHealthOverview: React.FC = () => {
  const s = useStyles()
  const fmt = useFormatters()
  const { data: stats, loading } = useAgentStats()
  const { data: latest } = useLatestInvestigation()
  const [selected, setSelected] = useState<AgentLike | null>(null)

  const fleet = useMemo(() => {
    const list = stats ?? []
    const totalRuns = list.reduce((sum, a) => sum + a.execution_count, 0)
    const confs = list.filter((a) => a.avg_confidence > 0)
    const avgConf = confs.length ? Math.round(confs.reduce((x, a) => x + a.avg_confidence, 0) / confs.length) : 0
    const success = list.length ? Math.round(list.reduce((x, a) => x + a.success_rate, 0) / list.length) : 0
    return { agents: list.length, totalRuns, avgConf, success }
  }, [stats])

  const openAgent = (role: string) => {
    const exec = (latest?.agents ?? []).find((a) => a.role === role)
    if (exec) {
      setSelected({ ...exec, incident_id: latest?.incident_id })
    } else {
      const st = (stats ?? []).find((a) => a.role === role)
      if (st) setSelected({ role: st.role, role_label: st.role_label, status: 'complete', confidence: st.avg_confidence, duration_seconds: st.avg_duration_seconds })
    }
  }

  if (loading) {
    return <div className={s.page}><div className={s.center}><Spinner label="Loading agent fleet…" /></div></div>
  }

  if (!stats || stats.length === 0) {
    return (
      <div className={s.page}>
        <span className={s.sectionLabel}>Agent Health Overview</span>
        <div className={s.card}>
          <EmptyState
            icon={<BotRegular />}
            title="No agent executions recorded"
            body="Run an investigation — each agent's real execution metadata (count, duration, confidence, success rate) appears here."
          />
        </div>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <span className={s.sectionLabel}>Agent Health Overview</span>
      <div className={s.stats}>
        <div className={s.stat}><span className={s.statLabel}>Agents</span><span className={s.statValue}>{fleet.agents}</span></div>
        <div className={s.stat}><span className={s.statLabel}>Total Executions</span><span className={s.statValue}>{fleet.totalRuns}</span></div>
        <div className={s.stat}><span className={s.statLabel}>Avg Confidence</span><span className={s.statValue} style={{ color: confidenceColor(fleet.avgConf) }}>{fleet.avgConf}%</span></div>
        <div className={s.stat}><span className={s.statLabel}>Success Rate</span><span className={s.statValue}>{fleet.success}%</span></div>
      </div>

      <span className={s.sectionLabel}>Agent Comparison</span>
      <div className={s.card}>
        <Table aria-label="Agent stats" size="medium">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Agent</TableHeaderCell>
              <TableHeaderCell>Executions</TableHeaderCell>
              <TableHeaderCell>Avg Duration</TableHeaderCell>
              <TableHeaderCell>Avg Confidence</TableHeaderCell>
              <TableHeaderCell>Success</TableHeaderCell>
              <TableHeaderCell>Last Execution</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((a) => (
              <TableRow key={a.role} className={s.row} tabIndex={0} onClick={() => openAgent(a.role)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openAgent(a.role) }}>
                <TableCell>
                  <TableCellLayout>
                    <span className={s.agentName}>
                      {a.role_label}
                      {AGENT_DESCRIPTIONS[a.role] && (
                        <Tooltip content={AGENT_DESCRIPTIONS[a.role]} relationship="description" withArrow>
                          <InfoRegular
                            className={s.info}
                            tabIndex={0}
                            aria-label={`About the ${a.role_label} agent`}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </Tooltip>
                      )}
                    </span>
                  </TableCellLayout>
                </TableCell>
                <TableCell className={s.num}>{a.execution_count}</TableCell>
                <TableCell className={s.num}>{a.avg_duration_seconds ? formatDuration(a.avg_duration_seconds) : '—'}</TableCell>
                <TableCell className={s.num} style={{ color: confidenceColor(a.avg_confidence) }}>{Math.round(a.avg_confidence)}%</TableCell>
                <TableCell className={s.num}>{a.success_rate}%</TableCell>
                <TableCell>{a.last_execution ? fmt.relative(a.last_execution) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AgentBlade agent={selected} open={selected !== null} onClose={() => setSelected(null)} />
    </div>
  )
}

/**
 * DashboardSummary — four at-a-glance widgets fed by the latest persisted
 * investigation (single source of truth). All values — confidence, agent count,
 * duration, recent findings — come from the real stored investigation record.
 */
import React, { useMemo } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import { useLatestInvestigation } from '../../hooks/useInsights'
import { useSession } from '../../store/SessionContext'
import { confidenceColor, LIFECYCLE_LABELS, asLifecycle } from '../../theme/tokens'
import { formatDuration } from '../../utils/formatters'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' },
  card: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '128px' },
  cardTitle: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  big: { fontSize: '26px', fontWeight: 700, color: tokens.colorNeutralForeground1, letterSpacing: '-0.5px', lineHeight: 1 },
  sub: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  pillRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  pill: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground2 },
  findings: { display: 'flex', flexDirection: 'column', gap: '8px' },
  finding: { display: 'flex', flexDirection: 'column', gap: '2px' },
  findingHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  findingRole: { fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1 },
  findingConf: { fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  findingText: { fontSize: '11px', color: tokens.colorNeutralForeground3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  muted: { fontSize: '12px', color: tokens.colorNeutralForeground4 },
})

export const DashboardSummary: React.FC = () => {
  const s = useStyles()
  const { data: record } = useLatestInvestigation()
  const { incidentStatus } = useSession()

  const status = asLifecycle(incidentStatus(record?.incident_id ?? ''))
  const agents = useMemo(() => record?.agents ?? [], [record])
  const confidence = record?.combined_confidence ?? 0
  const recCount = record?.recommendations.length ?? 0
  const completed = agents.filter((a) => a.status === 'complete').length
  const recent = useMemo(
    () => [...agents].filter((a) => a.finding && a.confidence > 0).sort((a, b) => b.confidence - a.confidence).slice(0, 3),
    [agents],
  )

  return (
    <div className={s.grid}>
      <div className={s.card}>
        <span className={s.cardTitle}>Investigation Summary</span>
        <span className={s.big} style={{ color: confidenceColor(confidence) }}>{confidence ? `${Math.round(confidence)}%` : '—'}</span>
        <div className={s.pillRow}>
          <span className={s.pill}>{LIFECYCLE_LABELS[status]}</span>
          <span className={s.pill}>{recCount} recommendation{recCount === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className={s.card}>
        <span className={s.cardTitle}>Agent Activity</span>
        <span className={s.big}>{completed}/{agents.length || '—'}</span>
        <span className={s.sub}>{record ? `${agents.length} agents executed` : 'awaiting first investigation'}</span>
      </div>

      <div className={s.card}>
        <span className={s.cardTitle}>Investigation Duration</span>
        <span className={s.big}>{record?.duration_seconds ? formatDuration(record.duration_seconds) : '—'}</span>
        <span className={s.sub}>{record ? `run ${record.id}` : 'no runs yet'}</span>
      </div>

      <div className={s.card}>
        <span className={s.cardTitle}>Recent Findings</span>
        {recent.length === 0 ? (
          <span className={s.muted}>No findings yet.</span>
        ) : (
          <div className={s.findings}>
            {recent.map((a) => (
              <div className={s.finding} key={a.role}>
                <div className={s.findingHead}>
                  <span className={s.findingRole}>{a.role_label}</span>
                  <span className={s.findingConf} style={{ color: confidenceColor(a.confidence) }}>{Math.round(a.confidence)}%</span>
                </div>
                <span className={s.findingText}>{a.finding}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

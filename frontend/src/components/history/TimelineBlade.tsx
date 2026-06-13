/**
 * TimelineBlade — the "Open Timeline" modal for a persisted investigation record.
 *
 * Opened from a History row. Shows the real agent execution timeline + RCA from
 * the stored investigation, with history actions (clone, export, replay) in the
 * footer.
 */
import React from 'react'
import { makeStyles, tokens, Button, Badge } from '@fluentui/react-components'
import { PlayRegular, CopyRegular, ArrowDownloadRegular } from '@fluentui/react-icons'
import { BladeModal, BladeSection } from '../shared/BladeModal'
import { useSession } from '../../store/SessionContext'
import { useNotify } from '../../store/NotificationContext'
import { useFormatters } from '../../store/PreferencesContext'
import { confidenceColor } from '../../theme/tokens'
import { formatCurrency, formatDuration } from '../../utils/formatters'
import { downloadBlob } from '../../utils/incidentExport'
import type { InvestigationRecord } from '../../api/insights'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: '13px' },
  gLabel: { color: tokens.colorNeutralForeground3 },
  gValue: { color: tokens.colorNeutralForeground1 },
  list: { listStyleType: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', color: tokens.colorNeutralForeground2 },
  role: { fontWeight: 600, color: tokens.colorNeutralForeground1 },
  conf: { fontVariantNumeric: 'tabular-nums', fontWeight: 700 },
  text: { fontSize: '12px', color: tokens.colorNeutralForeground2, lineHeight: 1.5 },
  muted: { fontSize: '12px', color: tokens.colorNeutralForeground4 },
})

export const TimelineBlade: React.FC<{
  record: InvestigationRecord | null
  open: boolean
  onClose: () => void
}> = ({ record, open, onClose }) => {
  const s = useStyles()
  const { createInvestigation } = useSession()
  const notify = useNotify()
  const fmt = useFormatters()

  if (!record) return null
  const rc = record.root_cause

  const clone = () => {
    createInvestigation({ description: `Clone of ${record.id}: ${rc.title || record.description}`.slice(0, 120), affectedServices: [] })
    window.dispatchEvent(new CustomEvent('opspilot:navigate', { detail: { page: 'incidents' } }))
    onClose()
  }
  const exportTimeline = () => {
    downloadBlob(`${record.id}.json`, JSON.stringify(record, null, 2), 'application/json')
    notify({ title: 'Investigation exported', body: `${record.id}.json`, intent: 'success' })
  }
  const replay = () => notify({ title: 'Replay (demo)', body: `Timeline replay for ${record.id} is not yet implemented.`, intent: 'warning' })

  return (
    <BladeModal
      open={open}
      onClose={onClose}
      title={rc.title || 'Investigation'}
      subtitle={`${record.id} · ${record.mode}`}
      headerBadge={<Badge appearance="tint" color={confidenceColor(record.combined_confidence) === '#4ade80' ? 'success' : 'informative'}>{Math.round(record.combined_confidence)}%</Badge>}
      actions={
        <>
          <Button appearance="primary" size="small" icon={<ArrowDownloadRegular />} onClick={exportTimeline}>Export</Button>
          <Button size="small" icon={<CopyRegular />} onClick={clone}>Clone</Button>
          <Button size="small" icon={<PlayRegular />} onClick={replay}>Replay</Button>
          <Badge appearance="tint" color="warning" title="Replay is demo-only.">Replay: demo</Badge>
        </>
      }
    >
      <BladeSection label="Overview">
        <div className={s.grid}>
          <span className={s.gLabel}>Completed</span><span className={s.gValue}>{record.completed_at ? fmt.timestamp(record.completed_at) : '—'}</span>
          <span className={s.gLabel}>Duration</span><span className={s.gValue}>{formatDuration(record.duration_seconds)}</span>
          <span className={s.gLabel}>Confidence</span><span className={s.gValue}>{Math.round(record.combined_confidence)}%{record.escalated ? ' · escalated' : ''}</span>
          <span className={s.gLabel}>Blast Radius</span><span className={s.gValue}>{rc.blast_radius || '—'} service(s)</span>
          <span className={s.gLabel}>Impact</span><span className={s.gValue}>{rc.hourly_impact_usd ? `${formatCurrency(rc.hourly_impact_usd)}/hr` : '—'}</span>
          <span className={s.gLabel}>Recommendations</span><span className={s.gValue}>{record.recommendations.length}</span>
        </div>
      </BladeSection>

      <BladeSection label="Agent Execution Timeline">
        {record.agents.length === 0 ? <span className={s.muted}>No agent executions recorded.</span> : (
          <ul className={s.list}>
            {record.agents.map((a) => (
              <li key={a.role} className={s.row}>
                <span><span className={s.role}>{a.role_label}</span> — {a.finding || a.status}</span>
                <span className={s.conf} style={{ color: confidenceColor(a.confidence) }}>{Math.round(a.confidence)}%</span>
              </li>
            ))}
          </ul>
        )}
      </BladeSection>

      <BladeSection label="Root Cause Analysis">
        <span className={rc.description ? s.text : s.muted}>{rc.description || 'No root cause recorded.'}</span>
      </BladeSection>
    </BladeModal>
  )
}

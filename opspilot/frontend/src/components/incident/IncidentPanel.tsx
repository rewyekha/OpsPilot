/**
 * Active Incidents — compact table (Task 4).
 *
 * Replaces the oversized single-incident cards with a dense, responsive table
 * that scales to many incidents. Rows are the live telemetry-detected /
 * user-created incidents (GET /api/incidents/active), joined with their
 * persisted investigation record (confidence, duration, root cause, status).
 */
import React, { useState } from 'react'
import { makeStyles, tokens, Button, Spinner } from '@fluentui/react-components'
import { OpenRegular } from '@fluentui/react-icons'
import { useActiveIncidents } from '../../hooks/useActiveIncidents'
import { useInvestigations } from '../../hooks/useInsights'
import { useFormatters } from '../../store/PreferencesContext'
import { SeverityBadge } from '../shared/SeverityBadge'
import { EmptyState } from '../shared/EmptyState'
import { confidenceColor } from '../../theme/tokens'
import { formatDuration } from '../../utils/formatters'
import type { InvestigationRecord } from '../../api/insights'

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px 22px' },
  center: { display: 'flex', justifyContent: 'center', padding: '60px' },
  headerRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  title: { fontSize: '18px', fontWeight: 700, color: tokens.colorNeutralForeground1 },
  count: { fontSize: '12px', fontWeight: 600, padding: '2px 9px', borderRadius: '10px',
    backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground2 },
  card: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px', padding: '20px' },
  tableWrap: { overflowX: 'auto', border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px',
    backgroundColor: tokens.colorNeutralBackground2 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '760px' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px',
    textTransform: 'uppercase', color: tokens.colorNeutralForeground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, whiteSpace: 'nowrap' },
  row: { transition: 'background-color 120ms ease', ':hover': { backgroundColor: tokens.colorNeutralBackground3 } },
  td: { padding: '10px 12px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground2, verticalAlign: 'middle', whiteSpace: 'nowrap' },
  incTitle: { fontWeight: 600, color: tokens.colorNeutralForeground1, maxWidth: '320px',
    overflow: 'hidden', textOverflow: 'ellipsis' },
  incId: { fontSize: '10.5px', color: tokens.colorNeutralForeground4, fontFamily: 'ui-monospace, monospace' },
  num: { fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
  pill: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 9px', borderRadius: '10px',
    fontSize: '11px', fontWeight: 600 },
  dot: { width: '6px', height: '6px', borderRadius: '50%' },
})

const STATUS_STYLE: Record<string, { c: string; bg: string }> = {
  Investigating: { c: '#60a5fa', bg: 'rgba(59,130,246,0.14)' },
  Investigated: { c: '#4ade80', bg: 'rgba(34,197,94,0.14)' },
}

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = useStyles()
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.Investigating
  return (
    <span className={s.pill} style={{ backgroundColor: cfg.bg, color: cfg.c }}>
      <span className={s.dot} style={{ backgroundColor: cfg.c }} />
      {status}
    </span>
  )
}

export const IncidentPanel: React.FC = () => {
  const s = useStyles()
  const fmt = useFormatters()
  const active = useActiveIncidents()
  const investigations = useInvestigations()
  const [, setTick] = useState(0)

  const recFor = (id: string): InvestigationRecord | undefined =>
    (investigations.data ?? []).find((r) => r.incident_id === id)

  const incidents = active.data ?? []
  const openDashboard = () => {
    setTick((t) => t + 1)
    window.dispatchEvent(new CustomEvent('opspilot:navigate', { detail: { page: 'home' } }))
  }

  if (active.loading && !active.data) {
    return <div className={s.center}><Spinner label="Loading active incidents…" /></div>
  }

  return (
    <div className={s.page}>
      <div className={s.headerRow}>
        <span className={s.title}>Active Incidents</span>
        <span className={s.count}>{incidents.length} active</span>
      </div>

      {incidents.length === 0 ? (
        <div className={s.card}>
          <EmptyState
            title="No active incidents detected"
            body="All monitored services are healthy. Incidents appear here automatically when Azure telemetry breaches a threshold, then OpsPilot investigates them."
          />
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                {['Severity', 'Incident', 'Service', 'Status', 'Confidence', 'Duration', 'Created', 'Action'].map((h) => (
                  <th key={h} className={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => {
                const rec = recFor(inc.id)
                const svc = inc.affected_services?.[0] ?? inc.id.replace(/^INC-/, '')
                const conf = rec?.combined_confidence ?? 0
                const status = rec?.status === 'complete' ? 'Investigated' : 'Investigating'
                const title = rec?.root_cause?.title || inc.description?.split(/\.\s/)[0] || inc.id
                const severity = rec?.severity || inc.severity || ''
                return (
                  <tr key={inc.id} className={s.row}>
                    <td className={s.td}>{severity ? <SeverityBadge severity={severity} pill /> : '—'}</td>
                    <td className={s.td}>
                      <div className={s.incTitle} title={title}>{title}</div>
                      <div className={s.incId}>{inc.id}</div>
                    </td>
                    <td className={s.td}>{svc}</td>
                    <td className={s.td}><StatusPill status={status} /></td>
                    <td className={s.td}>
                      <span className={s.num} style={{ color: conf ? confidenceColor(conf) : tokens.colorNeutralForeground4 }}>
                        {conf ? `${Math.round(conf)}%` : '—'}
                      </span>
                    </td>
                    <td className={s.td}>{rec ? formatDuration(rec.duration_seconds) : '—'}</td>
                    <td className={s.td}>{inc.created_at ? fmt.relative(inc.created_at) : '—'}</td>
                    <td className={s.td}>
                      <Button size="small" icon={<OpenRegular />} onClick={openDashboard}>Open</Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

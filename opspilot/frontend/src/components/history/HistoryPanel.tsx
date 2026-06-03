/**
 * HistoryPanel — the History workspace.
 *
 * Lists closed incidents (from SessionContext lifecycle records) in a table;
 * clicking a row reopens the full investigation details in a drawer. The live
 * Investigation Timeline for the active incident remains below.
 */
import React, { useState } from 'react'
import {
  makeStyles,
  tokens,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableBody,
  TableCell,
  TableCellLayout,
} from '@fluentui/react-components'
import { useSession, type IncidentSessionRecord } from '../../store/SessionContext'
import { InvestigationTimelinePanel } from '../timeline/InvestigationTimelinePanel'
import { IncidentStatusBadge } from '../shared/SeverityBadge'
import { DetailDrawer, DrawerSection } from '../shared/DetailDrawer'
import { useFormatters } from '../../store/PreferencesContext'
import { formatCurrency, formatDuration } from '../../utils/formatters'

const useStyles = makeStyles({
  page: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  empty: { padding: '16px', fontSize: '13px', color: tokens.colorNeutralForeground3 },
  mono: { fontFamily: '"Cascadia Code", "Consolas", monospace' },
  row: { cursor: 'pointer', ':hover': { backgroundColor: tokens.colorNeutralBackground3 } },
  grid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: '13px' },
  gLabel: { color: tokens.colorNeutralForeground3 },
  gValue: { color: tokens.colorNeutralForeground1 },
  evList: { listStyleType: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' },
  evItem: { fontSize: '13px', color: tokens.colorNeutralForeground2 },
})

function durationSeconds(rec: IncidentSessionRecord): number | null {
  if (!rec.startedAt) return null
  const end = rec.closedAt ?? rec.resolvedAt
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(rec.startedAt).getTime()
  return Number.isNaN(ms) ? null : ms / 1000
}

export const HistoryPanel: React.FC = () => {
  const s = useStyles()
  const { closedIncidents, timelineEvents } = useSession()
  const fmt = useFormatters()
  const [selected, setSelected] = useState<IncidentSessionRecord | null>(null)

  const selectedEvents = selected
    ? timelineEvents.filter((e) => e.incidentId === selected.id)
    : []

  return (
    <div className={s.page}>
      <span className={s.sectionLabel}>Closed Incidents</span>
      <div className={s.card}>
        {closedIncidents.length === 0 ? (
          <div className={s.empty}>
            No closed incidents yet. Resolve and close an incident from the Dashboard to archive it here.
          </div>
        ) : (
          <Table aria-label="Closed incidents" size="medium">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Incident ID</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Root Cause</TableHeaderCell>
                <TableHeaderCell>Duration</TableHeaderCell>
                <TableHeaderCell>Impact</TableHeaderCell>
                <TableHeaderCell>Resolution Time</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closedIncidents.map((rec) => (
                <TableRow
                  key={rec.id}
                  className={s.row}
                  onClick={() => setSelected(rec)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelected(rec)
                  }}
                >
                  <TableCell>
                    <TableCellLayout className={s.mono}>{rec.id}</TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <IncidentStatusBadge status={rec.status} />
                  </TableCell>
                  <TableCell>
                    <TableCellLayout truncate>{rec.rootCause ?? '—'}</TableCellLayout>
                  </TableCell>
                  <TableCell>{formatDuration(durationSeconds(rec))}</TableCell>
                  <TableCell>{rec.impactUsd != null ? `${formatCurrency(rec.impactUsd)}/hr` : '—'}</TableCell>
                  <TableCell>{rec.resolvedAt ? fmt.timestamp(rec.resolvedAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <span className={s.sectionLabel}>Active Investigation Timeline</span>
      <InvestigationTimelinePanel />

      {/* Reopen full investigation details */}
      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? selected?.id ?? 'Incident'}
        subtitle={selected?.id}
        headerAction={selected && <IncidentStatusBadge status={selected.status} />}
      >
        {selected && (
          <>
            <DrawerSection label="Overview">
              <div className={s.grid}>
                <span className={s.gLabel}>Root Cause</span>
                <span className={s.gValue}>{selected.rootCause ?? '—'}</span>
                <span className={s.gLabel}>Blast Radius</span>
                <span className={s.gValue}>{selected.blastRadius ?? '—'} service(s)</span>
                <span className={s.gLabel}>Impact</span>
                <span className={s.gValue}>
                  {selected.impactUsd != null ? `${formatCurrency(selected.impactUsd)}/hr` : '—'}
                </span>
                <span className={s.gLabel}>Duration</span>
                <span className={s.gValue}>{formatDuration(durationSeconds(selected))}</span>
                <span className={s.gLabel}>Resolved</span>
                <span className={s.gValue}>
                  {selected.resolvedAt ? fmt.timestamp(selected.resolvedAt) : '—'}
                </span>
                <span className={s.gLabel}>Closed</span>
                <span className={s.gValue}>
                  {selected.closedAt ? fmt.timestamp(selected.closedAt) : '—'}
                </span>
              </div>
            </DrawerSection>

            <DrawerSection label="Investigation Activity">
              {selectedEvents.length ? (
                <ul className={s.evList}>
                  {selectedEvents.map((e) => (
                    <li key={e.id} className={s.evItem}>
                      <span className={s.gLabel}>{fmt.time(e.timestamp)}</span> — {e.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={s.empty}>No recorded activity for this incident.</span>
              )}
            </DrawerSection>
          </>
        )}
      </DetailDrawer>
    </div>
  )
}

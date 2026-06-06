/**
 * HistoryPanel — real investigation history (Task 3).
 *
 * Reads persisted investigation records (GET /api/investigations) — the single
 * source of truth — so history survives a page refresh and contains zero
 * fabricated investigations. Stats + table are computed from the records; rows
 * open the record's timeline. Time-range + free-text filters included.
 */
import React, { useMemo, useState } from 'react'
import {
  makeStyles, tokens, Table, TableHeader, TableHeaderCell, TableRow, TableBody,
  TableCell, TableCellLayout, SearchBox, Button, Spinner, mergeClasses, Badge,
} from '@fluentui/react-components'
import { ArrowDownloadRegular, HistoryRegular } from '@fluentui/react-icons'
import { useInvestigations } from '../../hooks/useInsights'
import { useFormatters } from '../../store/PreferencesContext'
import { useNotify } from '../../store/NotificationContext'
import { TimelineBlade } from './TimelineBlade'
import { EmptyState } from '../shared/EmptyState'
import { confidenceColor } from '../../theme/tokens'
import { formatDuration } from '../../utils/formatters'
import { downloadBlob } from '../../utils/incidentExport'
import type { InvestigationRecord } from '../../api/insights'

const useStyles = makeStyles({
  page: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  sectionLabel: { fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' },
  stat: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  statLabel: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  statValue: { fontSize: '22px', fontWeight: 700, color: tokens.colorNeutralForeground1, letterSpacing: '-0.4px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  filters: { display: 'flex', gap: '4px' },
  filterBtn: { fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: `1px solid ${tokens.colorNeutralStroke1}`, backgroundColor: tokens.colorNeutralBackground2, color: tokens.colorNeutralForeground2, cursor: 'pointer', ':hover': { backgroundColor: tokens.colorNeutralBackground3 } },
  filterActive: { backgroundColor: tokens.colorBrandBackground2, border: `1px solid ${tokens.colorBrandStroke1}`, color: tokens.colorNeutralForeground1, fontWeight: 600 },
  spacer: { flex: 1 },
  card: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px', overflow: 'hidden' },
  mono: { fontFamily: '"Cascadia Code", "Consolas", monospace' },
  row: { cursor: 'pointer', ':hover': { backgroundColor: tokens.colorNeutralBackground3 } },
  num: { fontVariantNumeric: 'tabular-nums' },
  center: { display: 'flex', justifyContent: 'center', padding: '32px' },
})

type RangeKey = 'today' | '7d' | '30d' | 'all'
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: 'all', label: 'All', days: null },
]

export const HistoryPanel: React.FC = () => {
  const s = useStyles()
  const fmt = useFormatters()
  const notify = useNotify()
  const { data: records, loading } = useInvestigations()
  const [selected, setSelected] = useState<InvestigationRecord | null>(null)
  const [range, setRange] = useState<RangeKey>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const all = records ?? []
    const days = RANGES.find((r) => r.key === range)?.days ?? null
    const cutoff = days ? Date.now() - days * 86_400_000 : null
    const q = query.trim().toLowerCase()
    return all.filter((r) => {
      if (cutoff) {
        const when = r.completed_at || r.started_at
        if (!when || new Date(when).getTime() < cutoff) return false
      }
      if (q) {
        const hay = `${r.id} ${r.description} ${r.root_cause?.title ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [records, range, query])

  const stats = useMemo(() => {
    const durs = filtered.map((r) => r.duration_seconds).filter((d) => d > 0)
    const confs = filtered.map((r) => r.combined_confidence).filter((c) => c > 0)
    return {
      total: filtered.length,
      avgDuration: durs.length ? durs.reduce((x, y) => x + y, 0) / durs.length : null,
      avgConfidence: confs.length ? Math.round(confs.reduce((x, y) => x + y, 0) / confs.length) : null,
      rootCauses: filtered.filter((r) => r.root_cause?.title).length,
    }
  }, [filtered])

  const exportHistory = () => {
    if (filtered.length === 0) { notify({ title: 'Nothing to export', body: 'No investigations match the filter.', intent: 'warning' }); return }
    downloadBlob('opspilot-history.json', JSON.stringify({ generated_at: new Date().toISOString(), count: filtered.length, investigations: filtered }, null, 2), 'application/json')
    notify({ title: 'History exported', body: `${filtered.length} investigation(s)`, intent: 'success' })
  }

  if (loading) {
    return <div className={s.page}><div className={s.center}><Spinner label="Loading investigation history…" /></div></div>
  }

  return (
    <div className={s.page}>
      <div className={s.headRow}>
        <span className={s.sectionLabel}>History Overview</span>
        <Button size="small" icon={<ArrowDownloadRegular />} onClick={exportHistory}>Export Report</Button>
      </div>
      <div className={s.stats}>
        <div className={s.stat}><span className={s.statLabel}>Investigations</span><span className={s.statValue}>{stats.total}</span></div>
        <div className={s.stat}><span className={s.statLabel}>Avg Duration</span><span className={s.statValue}>{stats.avgDuration != null ? formatDuration(stats.avgDuration) : '—'}</span></div>
        <div className={s.stat}><span className={s.statLabel}>Avg Confidence</span><span className={s.statValue}>{stats.avgConfidence != null ? `${stats.avgConfidence}%` : '—'}</span></div>
        <div className={s.stat}><span className={s.statLabel}>Root Causes Identified</span><span className={s.statValue}>{stats.rootCauses}</span></div>
      </div>

      <div className={s.toolbar}>
        <div className={s.filters} role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.key} role="tab" aria-selected={range === r.key}
              className={mergeClasses(s.filterBtn, range === r.key && s.filterActive)} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className={s.spacer} />
        <SearchBox placeholder="Search id, description, root cause…" value={query} onChange={(_, d) => setQuery(d.value)} aria-label="Search history" />
      </div>

      <div className={s.card}>
        {(records ?? []).length === 0 ? (
          <EmptyState icon={<HistoryRegular />} title="No investigations found"
            body="Run an investigation from the Dashboard. Every completed investigation is persisted here — surviving page refresh — with its agents, root cause and recommendations." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" body="No investigations match the current filter." />
        ) : (
          <Table aria-label="Investigation history" size="medium">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Investigation</TableHeaderCell>
                <TableHeaderCell>Completed</TableHeaderCell>
                <TableHeaderCell>Duration</TableHeaderCell>
                <TableHeaderCell>Confidence</TableHeaderCell>
                <TableHeaderCell>Root Cause</TableHeaderCell>
                <TableHeaderCell>Recs</TableHeaderCell>
                <TableHeaderCell>Agents</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className={s.row} tabIndex={0} onClick={() => setSelected(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(r) }}>
                  <TableCell><TableCellLayout className={s.mono}>{r.id}</TableCellLayout></TableCell>
                  <TableCell>{r.completed_at ? fmt.timestamp(r.completed_at) : '—'}</TableCell>
                  <TableCell className={s.num}>{formatDuration(r.duration_seconds)}</TableCell>
                  <TableCell className={s.num} style={{ color: confidenceColor(r.combined_confidence) }}>{Math.round(r.combined_confidence)}%</TableCell>
                  <TableCell><TableCellLayout truncate>{r.root_cause?.title ?? '—'}</TableCellLayout></TableCell>
                  <TableCell className={s.num}>{r.recommendations.length}</TableCell>
                  <TableCell><Badge appearance="tint" color="informative">{r.agents.length}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TimelineBlade record={selected} open={selected !== null} onClose={() => setSelected(null)} />
    </div>
  )
}

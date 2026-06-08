/**
 * DashboardSummary — four at-a-glance widgets fed by the latest persisted
 * investigation (single source of truth). All values — confidence, agent count,
 * duration, recent findings — come from the real stored investigation record.
 *
 * Each Recent Finding is clickable → opens a dialog with the FULL finding text +
 * evidence (the card itself clamps to 2 lines, so this is how you read it all).
 */
import React, { useMemo, useState } from 'react'
import {
  makeStyles, tokens, Dialog, DialogSurface, DialogBody, DialogTitle,
  DialogContent, DialogActions, Button,
} from '@fluentui/react-components'
import { OpenRegular } from '@fluentui/react-icons'
import { useLatestInvestigation } from '../../hooks/useInsights'
import { useSession } from '../../store/SessionContext'
import { confidenceColor, LIFECYCLE_LABELS, asLifecycle } from '../../theme/tokens'
import { useMountLog } from '../../utils/debugMountLog' // TEMP-DEBUG
import { formatDuration } from '../../utils/formatters'
import type { AgentExecution } from '../../api/insights'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' },
  card: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '128px',
    transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
    ':hover': { transform: 'translateY(-2px)', border: `1px solid ${tokens.colorNeutralStroke2}`, boxShadow: '0 8px 22px rgba(0,0,0,0.3)' } },
  cardTitle: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  big: { fontSize: '26px', fontWeight: 700, color: tokens.colorNeutralForeground1, letterSpacing: '-0.5px', lineHeight: 1 },
  sub: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  pillRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  pill: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground2 },
  findings: { display: 'flex', flexDirection: 'column', gap: '6px' },
  finding: { display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer', padding: '4px 6px', margin: '0 -6px', borderRadius: '6px',
    transition: 'background-color 120ms ease',
    ':hover': { backgroundColor: tokens.colorNeutralBackground3 },
    ':focus-visible': { outline: `2px solid ${tokens.colorBrandStroke1}`, outlineOffset: '1px' } },
  findingHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  findingRole: { fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1, display: 'flex', alignItems: 'center', gap: '5px' },
  findingConf: { fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  findingText: { fontSize: '11px', color: tokens.colorNeutralForeground3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  expandIcon: { fontSize: '11px', color: tokens.colorNeutralForeground4 },
  muted: { fontSize: '12px', color: tokens.colorNeutralForeground4 },
  // Dialog
  modalConf: { fontSize: '13px', fontWeight: 700 },
  modalFinding: { fontSize: '14px', lineHeight: 1.55, color: tokens.colorNeutralForeground1, margin: '4px 0 0', whiteSpace: 'pre-wrap' },
  modalLabel: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3, margin: '16px 0 6px' },
  evidenceList: { margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' },
  evidenceItem: { fontSize: '13px', lineHeight: 1.45, color: tokens.colorNeutralForeground2 },
  metaRow: { display: 'flex', gap: '14px', fontSize: '11px', color: tokens.colorNeutralForeground3, marginTop: '12px' },
})

export const DashboardSummary: React.FC = () => {
  const s = useStyles()
  useMountLog('DashboardSummary') // TEMP-DEBUG
  const { data: record } = useLatestInvestigation()
  const { incidentStatus } = useSession()
  const [openFinding, setOpenFinding] = useState<AgentExecution | null>(null)

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
    <>
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
                <div
                  className={s.finding}
                  key={a.role}
                  role="button"
                  tabIndex={0}
                  title="Click to read the full finding"
                  onClick={() => setOpenFinding(a)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenFinding(a) } }}
                >
                  <div className={s.findingHead}>
                    <span className={s.findingRole}>{a.role_label}<OpenRegular className={s.expandIcon} /></span>
                    <span className={s.findingConf} style={{ color: confidenceColor(a.confidence) }}>{Math.round(a.confidence)}%</span>
                  </div>
                  <span className={s.findingText}>{a.finding}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={openFinding !== null} onOpenChange={(_, d) => { if (!d.open) setOpenFinding(null) }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {openFinding?.role_label} Agent{'  '}
              <span className={s.modalConf} style={{ color: confidenceColor(openFinding?.confidence ?? 0) }}>
                {Math.round(openFinding?.confidence ?? 0)}% confidence
              </span>
            </DialogTitle>
            <DialogContent>
              <p className={s.modalFinding}>{openFinding?.finding}</p>
              {openFinding?.evidence && openFinding.evidence.length > 0 && (
                <>
                  <div className={s.modalLabel}>Evidence</div>
                  <ul className={s.evidenceList}>
                    {openFinding.evidence.map((e, i) => (
                      <li className={s.evidenceItem} key={i}>{e}</li>
                    ))}
                  </ul>
                </>
              )}
              <div className={s.metaRow}>
                <span>Status: {openFinding?.status}</span>
                {openFinding?.duration_seconds ? <span>Duration: {formatDuration(openFinding.duration_seconds)}</span> : null}
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setOpenFinding(null)}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  )
}

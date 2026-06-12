/**
 * ReportDrawer — the Report Center.
 *
 * Renders a full incident report (Executive Summary, Timeline, Root Cause,
 * Evidence, Actions Taken, Impact Analysis, Recommendations) from data already
 * in the app, and offers Download Markdown / Export JSON / Copy Report. No
 * backend involvement — serialisation is client-side via utils/incidentExport.
 */
import React from 'react'
import { makeStyles, tokens, Button } from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  CodeRegular,
  CopyRegular,
} from '@fluentui/react-icons'
import { DetailDrawer, DrawerSection, EvidenceList } from '../shared/DetailDrawer'
import { RiskBadge } from '../shared/SeverityBadge'
import { ConfidenceBar } from '../shared/ConfidenceBar'
import { confidenceColor } from '../../theme/tokens'
import { useNotify } from '../../store/NotificationContext'
import { useFormatters } from '../../store/PreferencesContext'
import {
  buildSnapshot,
  snapshotToMarkdown,
  downloadBlob,
  type SnapshotInput,
} from '../../utils/incidentExport'

const useStyles = makeStyles({
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  p: { fontSize: '13px', color: tokens.colorNeutralForeground2, lineHeight: '1.6', margin: 0 },
  meta: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  grid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', fontSize: '13px' },
  gLabel: { color: tokens.colorNeutralForeground3 },
  gValue: { color: tokens.colorNeutralForeground1 },
  list: { margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' },
  item: { fontSize: '13px', color: tokens.colorNeutralForeground2, lineHeight: 1.5 },
  sub: { fontSize: '13px', fontWeight: 600, color: tokens.colorNeutralForeground1, margin: '4px 0 2px' },

  // ── Executive summary cards (at-a-glance, before detailed evidence) ──────────
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '1px',
    backgroundColor: tokens.colorNeutralStroke1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  summaryCell: { backgroundColor: tokens.colorNeutralBackground2, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  summaryLabel: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  summaryValue: { fontSize: '15px', fontWeight: 700, color: tokens.colorNeutralForeground1, lineHeight: 1.3 },

  // ── Confidence breakdown (explainability) ───────────────────────────────────
  breakdown: { display: 'flex', flexDirection: 'column', gap: '8px' },
  breakdownRow: { display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center', gap: '12px' },
  breakdownLabel: { fontSize: '12px', color: tokens.colorNeutralForeground2 },
  breakdownOverall: { marginTop: '4px', paddingTop: '10px', borderTop: `1px solid ${tokens.colorNeutralStroke1}` },
  breakdownLabelStrong: { fontSize: '12px', fontWeight: 700, color: tokens.colorNeutralForeground1 },
})

export interface ReportDrawerProps {
  input: SnapshotInput
  open: boolean
  onClose: () => void
}

export const ReportDrawer: React.FC<ReportDrawerProps> = ({ input, open, onClose }) => {
  const s = useStyles()
  const notify = useNotify()
  const fmt = useFormatters()

  const { rootCause, actions = [], agents = [], jobs = [], sessionEvents = [] } = input

  // Per-agent confidence drives the explainability breakdown — only agents that
  // actually produced a confidence score (real execution output, never fabricated).
  const breakdownAgents = agents.filter((a) => a.confidence > 0)

  const handleMarkdown = () => {
    downloadBlob(`${input.incidentId}-report.md`, snapshotToMarkdown(input), 'text/markdown')
    notify({ title: 'Report downloaded', body: `${input.incidentId}-report.md`, intent: 'success' })
  }
  const handleJson = () => {
    downloadBlob(
      `${input.incidentId}-report.json`,
      JSON.stringify(buildSnapshot(input), null, 2),
      'application/json',
    )
    notify({ title: 'Report exported', body: `${input.incidentId}-report.json`, intent: 'success' })
  }
  const handleCopy = () => {
    void navigator.clipboard
      .writeText(snapshotToMarkdown(input))
      .then(() => notify({ title: 'Report copied', body: 'Markdown copied to clipboard', intent: 'success' }))
      .catch(() => notify({ title: 'Copy failed', body: 'Clipboard unavailable', intent: 'error' }))
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Incident Report"
      subtitle={input.incidentId}
      size="large"
    >
      <div className={s.actions}>
        <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={handleMarkdown}>
          Download Markdown
        </Button>
        <Button appearance="secondary" icon={<CodeRegular />} onClick={handleJson}>
          Export JSON
        </Button>
        <Button appearance="secondary" icon={<CopyRegular />} onClick={handleCopy}>
          Copy Report
        </Button>
      </div>

      <DrawerSection label="Executive Summary">
        {rootCause && (
          <div className={s.summaryGrid}>
            <div className={s.summaryCell}>
              <span className={s.summaryLabel}>Root Cause</span>
              <span className={s.summaryValue}>{rootCause.title}</span>
            </div>
            <div className={s.summaryCell}>
              <span className={s.summaryLabel}>Confidence</span>
              <span className={s.summaryValue} style={{ color: confidenceColor(rootCause.confidence) }}>
                {Math.round(rootCause.confidence)}%
              </span>
            </div>
            <div className={s.summaryCell}>
              <span className={s.summaryLabel}>Impact</span>
              <span className={s.summaryValue}>
                {rootCause.blast_radius} service{rootCause.blast_radius === 1 ? '' : 's'} · {rootCause.affected_users.toLocaleString()} users
              </span>
            </div>
            <div className={s.summaryCell}>
              <span className={s.summaryLabel}>Recommendations</span>
              <span className={s.summaryValue}>{actions.length}</span>
            </div>
          </div>
        )}
        <p className={s.p}>
          {rootCause
            ? `${rootCause.title} — ${rootCause.description} Confidence ${Math.round(
                rootCause.confidence,
              )}%, ${rootCause.blast_radius} service(s) affected, ~${rootCause.affected_users.toLocaleString()} users impacted.`
            : 'No root cause synthesized yet.'}
        </p>
      </DrawerSection>

      {breakdownAgents.length > 0 && (
        <DrawerSection label="Investigation Confidence Breakdown">
          <div className={s.breakdown}>
            {breakdownAgents.map((a) => (
              <div key={a.id} className={s.breakdownRow}>
                <span className={s.breakdownLabel}>{a.role_label}</span>
                <ConfidenceBar value={a.confidence} animate={false} />
              </div>
            ))}
            {typeof input.combinedConfidence === 'number' && (
              <div className={`${s.breakdownRow} ${s.breakdownOverall}`}>
                <span className={s.breakdownLabelStrong}>Overall Confidence</span>
                <ConfidenceBar value={input.combinedConfidence} animate={false} />
              </div>
            )}
          </div>
        </DrawerSection>
      )}

      <DrawerSection label="Timeline">
        {sessionEvents.length ? (
          <ul className={s.list}>
            {sessionEvents.map((e) => (
              <li key={e.id} className={s.item}>
                <span className={s.meta}>{fmt.time(e.timestamp)}</span> — {e.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.meta}>No operator activity recorded this session.</p>
        )}
      </DrawerSection>

      <DrawerSection label="Root Cause">
        {rootCause ? (
          <div className={s.grid}>
            <span className={s.gLabel}>Title</span>
            <span className={s.gValue}>{rootCause.title}</span>
            <span className={s.gLabel}>Detail</span>
            <span className={s.gValue}>{rootCause.description}</span>
            <span className={s.gLabel}>Confidence</span>
            <span className={s.gValue}>{Math.round(rootCause.confidence)}%</span>
          </div>
        ) : (
          <p className={s.meta}>Not available.</p>
        )}
      </DrawerSection>

      <DrawerSection label="Evidence">
        {agents.length ? (
          agents.map((a) => (
            <div key={a.id}>
              <p className={s.sub}>
                {a.role_label} · {Math.round(a.confidence)}%
              </p>
              <EvidenceList items={a.evidence} />
            </div>
          ))
        ) : (
          <p className={s.meta}>No agent evidence available.</p>
        )}
      </DrawerSection>

      <DrawerSection label="Actions Taken">
        {jobs.length ? (
          <ul className={s.list}>
            {jobs.map((j) => (
              <li key={j.jobId} className={s.item}>
                {j.actionTitle} — <span className={s.meta}>{j.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.meta}>No remediation actions executed this session.</p>
        )}
      </DrawerSection>

      <DrawerSection label="Impact Analysis">
        {rootCause ? (
          <div className={s.grid}>
            <span className={s.gLabel}>Services</span>
            <span className={s.gValue}>{rootCause.blast_radius}</span>
            <span className={s.gLabel}>Users</span>
            <span className={s.gValue}>~{rootCause.affected_users.toLocaleString()}</span>
            <span className={s.gLabel}>Cost</span>
            <span className={s.gValue}>${Math.round(rootCause.hourly_impact_usd).toLocaleString()}/hr</span>
          </div>
        ) : (
          <p className={s.meta}>Not available.</p>
        )}
      </DrawerSection>

      <DrawerSection label="Recommendations">
        {actions.length ? (
          <ul className={s.list}>
            {[...actions]
              .sort((a, b) => a.priority - b.priority)
              .map((r) => (
                <li key={r.id} className={s.item}>
                  <strong>{r.title}</strong> <RiskBadge risk={r.risk} label={r.risk_label} /> — {r.description}
                </li>
              ))}
          </ul>
        ) : (
          <p className={s.meta}>No recommendations available.</p>
        )}
      </DrawerSection>
    </DetailDrawer>
  )
}

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
        <p className={s.p}>
          {rootCause
            ? `${rootCause.title} — ${rootCause.description} Confidence ${Math.round(
                rootCause.confidence,
              )}%, ${rootCause.blast_radius} service(s) affected, ~${rootCause.affected_users.toLocaleString()} users impacted.`
            : 'No root cause synthesized yet.'}
        </p>
      </DrawerSection>

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

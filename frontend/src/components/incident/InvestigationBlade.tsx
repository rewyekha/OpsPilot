/**
 * InvestigationBlade — the "Open Investigation" modal (Azure-blade style).
 *
 * Consolidates everything that used to be scattered as dashboard buttons:
 * details, findings, evidence, recommendations and the live timeline, with ALL
 * investigation actions in the footer (re-run, deep reasoning, export RCA, mark
 * resolved, close). Opened from the dashboard's single "Open Investigation"
 * primary action.
 */
import React, { useState } from 'react'
import { makeStyles, tokens, Button, Spinner, Badge } from '@fluentui/react-components'
import {
  ArrowSyncRegular,
  BrainCircuitRegular,
  DocumentArrowDownRegular,
  CheckmarkCircleRegular,
  LockClosedRegular,
} from '@fluentui/react-icons'
import { BladeModal, BladeSection } from '../shared/BladeModal'
import { ConfidenceBar } from '../shared/ConfidenceBar'
import { SeverityBadge, IncidentStatusBadge } from '../shared/SeverityBadge'
import { useActiveSnapshot } from '../../hooks/useActiveSnapshot'
import { useSession } from '../../store/SessionContext'
import { useNotify } from '../../store/NotificationContext'
import { useFormatters } from '../../store/PreferencesContext'
import { EXPORT_STEM } from '../../utils/constants'
import { confidenceColor } from '../../theme/tokens'
import { formatCurrency, formatDuration } from '../../utils/formatters'
import { snapshotToMarkdown, downloadBlob } from '../../utils/incidentExport'
import { investigationsApi, type DeepReasoningResult } from '../../api/investigations'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' },
  kpi: { display: 'flex', flexDirection: 'column', gap: '3px' },
  kpiLabel: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  kpiValue: { fontSize: '16px', fontWeight: 700, color: tokens.colorNeutralForeground1 },
  finding: { display: 'flex', flexDirection: 'column', gap: '3px', paddingBottom: '8px' },
  fHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  fRole: { fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1 },
  fConf: { fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  fText: { fontSize: '12px', color: tokens.colorNeutralForeground2, lineHeight: 1.5 },
  trace: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  },
  list: { listStyleType: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' },
  li: { fontSize: '12px', color: tokens.colorNeutralForeground2, lineHeight: 1.5, paddingLeft: '14px', position: 'relative' },
  rec: { display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '8px' },
  recTitle: { fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1 },
  recMeta: { fontSize: '11px', color: tokens.colorNeutralForeground3 },
  tlRow: { display: 'flex', gap: '10px', fontSize: '12px', color: tokens.colorNeutralForeground2 },
  tlTime: { color: tokens.colorNeutralForeground3, flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  muted: { fontSize: '12px', color: tokens.colorNeutralForeground4 },
})

export const InvestigationBlade: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const s = useStyles()
  const { buildInput } = useActiveSnapshot()
  const { incidentStatus, markResolved, closeIncident } = useSession()
  const notify = useNotify()
  const fmt = useFormatters()

  const [rerunning, setRerunning] = useState(false)
  const [reasoning, setReasoning] = useState<DeepReasoningResult | null>(null)
  const [reasoningLoading, setReasoningLoading] = useState(false)

  const input = buildInput()
  const rc = input.rootCause
  const agents = input.agents ?? []
  const actions = input.actions ?? []
  const events = input.sessionEvents ?? []
  // Real incident id from the snapshot (latest investigation). Empty → no active incident.
  const incidentId = input.incident?.id ?? ''
  const status = incidentStatus(incidentId)
  const confidence = rc?.confidence ?? 0
  const totalDuration = agents.reduce((sum, a) => sum + (a.duration_seconds ?? 0), 0)
  const evidence = agents.flatMap((a) => a.evidence ?? [])
  const canResolve = status === 'investigating' || status === 'mitigating' || status === 'monitoring'
  const canClose = status === 'resolved'

  // REAL: launches the InvestigationOrchestrator on the backend (agent graph).
  const rerun = async () => {
    setRerunning(true)
    try {
      const res = await investigationsApi.rerun(incidentId)
      if (res.status === 'already_running') {
        notify({ title: 'Investigation already running', body: 'A run is in progress for this incident.', intent: 'info' })
      } else {
        notify({ title: 'Investigation re-running', body: `Agents dispatched (${res.mode} execution). Live progress on the stream.`, intent: 'success' })
        // Reconnect the dashboard stream so live agent events render.
        window.dispatchEvent(new CustomEvent('opspilot:refresh'))
      }
    } catch (e) {
      notify({ title: 'Re-run failed', body: e instanceof Error ? e.message : 'Backend unreachable.', intent: 'error' })
    } finally {
      setRerunning(false)
    }
  }

  // REAL: sends findings + root cause to the o4-mini DeepReasoningAgent.
  const deepReasoning = async () => {
    setReasoningLoading(true)
    try {
      const findings = agents
        .filter((a) => a.finding)
        .map((a) => ({ role: a.role, summary: a.finding, evidence: a.evidence ?? [], confidence: a.confidence }))
      const result = await investigationsApi.deepReasoning(incidentId, {
        incident_description: input.incident?.description ?? rc?.title ?? incidentId,
        findings,
        root_cause: rc ? { role: 'root_cause', summary: rc.description, evidence: rc.evidence ?? [], confidence: rc.confidence } : null,
      })
      setReasoning(result)
      notify({ title: 'Deep reasoning complete', body: `Refined confidence ${Math.round(result.confidence)}% (${result.mode} o4-mini).`, intent: 'success' })
    } catch (e) {
      notify({ title: 'Deep reasoning failed', body: e instanceof Error ? e.message : 'Backend unreachable.', intent: 'error' })
    } finally {
      setReasoningLoading(false)
    }
  }

  const exportRca = () => {
    const stem = incidentId || EXPORT_STEM
    downloadBlob(`${stem}-RCA.md`, snapshotToMarkdown(input), 'text/markdown')
    notify({ title: 'RCA exported', body: `${stem}-RCA.md`, intent: 'success' })
  }

  return (
    <BladeModal
      open={open}
      onClose={onClose}
      title={rc?.title ?? 'Active Investigation'}
      subtitle={incidentId || '—'}
      headerBadge={<IncidentStatusBadge status={status} />}
      actions={
        <>
          <Button appearance="primary" size="small" icon={rerunning ? <Spinner size="tiny" /> : <ArrowSyncRegular />} disabled={rerunning || !incidentId} onClick={rerun}>Re-run Investigation</Button>
          <Button size="small" icon={reasoningLoading ? <Spinner size="tiny" /> : <BrainCircuitRegular />} disabled={reasoningLoading || !incidentId} onClick={deepReasoning}>Deep Reasoning</Button>
          <Button size="small" icon={<DocumentArrowDownRegular />} onClick={exportRca}>Export RCA</Button>
          <Button size="small" icon={<CheckmarkCircleRegular />} disabled={!canResolve} onClick={() => markResolved(incidentId)}>Mark Resolved</Button>
          <Button size="small" icon={<LockClosedRegular />} disabled={!canClose} onClick={() => closeIncident(incidentId)}>Close</Button>
        </>
      }
    >
      <BladeSection label="Details">
        <div className={s.kpis}>
          <div className={s.kpi}><span className={s.kpiLabel}>Confidence</span><span className={s.kpiValue} style={{ color: confidenceColor(confidence) }}>{confidence ? `${Math.round(confidence)}%` : '—'}</span></div>
          <div className={s.kpi}><span className={s.kpiLabel}>Duration</span><span className={s.kpiValue}>{totalDuration ? formatDuration(totalDuration) : '—'}</span></div>
          <div className={s.kpi}><span className={s.kpiLabel}>Severity</span><span className={s.kpiValue}>{input.incident ? <SeverityBadge severity={input.incident.severity} pill /> : '—'}</span></div>
          <div className={s.kpi}><span className={s.kpiLabel}>Blast Radius</span><span className={s.kpiValue}>{rc?.blast_radius ?? '—'} svc</span></div>
          <div className={s.kpi}><span className={s.kpiLabel}>Users</span><span className={s.kpiValue}>{rc ? rc.affected_users.toLocaleString() : '—'}</span></div>
          <div className={s.kpi}><span className={s.kpiLabel}>Cost</span><span className={s.kpiValue} style={{ color: '#f87171' }}>{rc ? `${formatCurrency(rc.hourly_impact_usd)}/hr` : '—'}</span></div>
        </div>
        {rc && <div className={s.fText} style={{ marginTop: 10 }}>{rc.description}</div>}
        {confidence > 0 && <div style={{ marginTop: 8 }}><ConfidenceBar value={confidence} /></div>}
      </BladeSection>

      {(reasoning || reasoningLoading) && (
        <BladeSection label="Deep Reasoning · o4-mini">
          {reasoningLoading && !reasoning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner size="tiny" /> <span className={s.fText}>Reasoning over findings…</span>
            </div>
          )}
          {reasoning && (
            <>
              <div className={s.fHead}>
                <span className={s.fRole}>{reasoning.title}</span>
                <Badge appearance="tint" color={reasoning.mode === 'live' ? 'success' : 'informative'}>
                  {reasoning.mode} · {Math.round(reasoning.confidence)}%
                </Badge>
              </div>
              <span className={s.fText}>{reasoning.description}</span>
              <div style={{ marginTop: 6 }}><ConfidenceBar value={reasoning.confidence} /></div>
              {reasoning.reasoning_trace && (
                <>
                  <span className={s.kpiLabel} style={{ marginTop: 8 }}>Reasoning trace</span>
                  <pre className={s.trace}>{reasoning.reasoning_trace}</pre>
                </>
              )}
              {reasoning.evidence.length > 0 && (
                <ul className={s.list}>{reasoning.evidence.map((e, i) => <li key={i} className={s.li}>• {e}</li>)}</ul>
              )}
            </>
          )}
        </BladeSection>
      )}

      <BladeSection label="Findings">
        {agents.length === 0 ? <span className={s.muted}>No agent findings yet.</span> : agents.map((a) => (
          <div className={s.finding} key={a.id}>
            <div className={s.fHead}>
              <span className={s.fRole}>{a.role_label}</span>
              <span className={s.fConf} style={{ color: confidenceColor(a.confidence) }}>{Math.round(a.confidence)}%</span>
            </div>
            <span className={s.fText}>{a.finding}</span>
          </div>
        ))}
      </BladeSection>

      <BladeSection label="Evidence">
        {evidence.length === 0 ? <span className={s.muted}>No evidence captured yet.</span> : (
          <ul className={s.list}>{evidence.map((e, i) => <li key={i} className={s.li}>• {e}</li>)}</ul>
        )}
      </BladeSection>

      <BladeSection label="Recommendations">
        {actions.length === 0 ? <span className={s.muted}>No recommendations available.</span> : [...actions].sort((a, b) => a.priority - b.priority).map((r) => (
          <div className={s.rec} key={r.id}>
            <span className={s.recTitle}>{r.priority}. {r.title}</span>
            <span className={s.recMeta}>{r.type_label} · {r.risk_label} · ETA {r.estimated_time}</span>
          </div>
        ))}
      </BladeSection>

      <BladeSection label="Timeline">
        {events.length === 0 ? <span className={s.muted}>No operator activity recorded this session.</span> : (
          <ul className={s.list}>
            {events.slice().reverse().map((e) => (
              <li key={e.id} className={s.tlRow}><span className={s.tlTime}>{fmt.time(e.timestamp)}</span><span>{e.title}</span></li>
            ))}
          </ul>
        )}
      </BladeSection>
    </BladeModal>
  )
}

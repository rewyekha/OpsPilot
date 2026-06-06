/**
 * ServiceBlade — the "Open Service" modal.
 *
 * Opened from a Monitored Services card's single primary action. Holds the
 * service detail (health, metrics, logs, dependencies) and the service actions
 * (investigate, restart, scale) in the footer — none of which clutter the card.
 */
import React from 'react'
import { makeStyles, tokens, Button, Badge } from '@fluentui/react-components'
import {
  SearchRegular,
  ArrowResetRegular,
  ArrowAutofitHeightRegular,
} from '@fluentui/react-icons'
import { BladeModal, BladeSection } from '../shared/BladeModal'
import { useSession } from '../../store/SessionContext'
import { useNotify } from '../../store/NotificationContext'
import { HEALTH_COLORS, HEALTH_LABELS, asHealth } from '../../theme/tokens'
import { useFormatters } from '../../store/PreferencesContext'
import type { ApiServiceHealth } from '../../api/services'

const useStyles = makeStyles({
  badge: { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '20px', padding: '0 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px' },
  dot: { width: '6px', height: '6px', borderRadius: '50%' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' },
  metric: { display: 'flex', flexDirection: 'column', gap: '3px' },
  mLabel: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  mValue: { fontSize: '16px', fontWeight: 700, color: tokens.colorNeutralForeground1 },
  muted: { fontSize: '12px', color: tokens.colorNeutralForeground4 },
})

export const ServiceBlade: React.FC<{ service: ApiServiceHealth | null; open: boolean; onClose: () => void }> = ({
  service,
  open,
  onClose,
}) => {
  const s = useStyles()
  const { createInvestigation } = useSession()
  const notify = useNotify()
  const fmt = useFormatters()

  if (!service) return null
  const health = asHealth(service.status)
  const cfg = HEALTH_COLORS[health]

  const investigate = () => {
    createInvestigation({ description: `Investigate ${service.name}: ${HEALTH_LABELS[health]} (error rate ${service.errorRatePct.toFixed(1)}%, p99 ${Math.round(service.responseTimeMs)}ms)`, affectedServices: [service.name] })
    window.dispatchEvent(new CustomEvent('opspilot:navigate', { detail: { page: 'incidents' } }))
    onClose()
  }
  // Demo-only: no live cluster mutation API is wired (Azure workloads torn down).
  const restart = () => notify({ title: 'Restart (demo)', body: `Demo action — no live restart performed for ${service.name}.`, intent: 'warning' })
  const scale = () => notify({ title: 'Scale (demo)', body: `Demo action — no live scale performed for ${service.name}.`, intent: 'warning' })

  return (
    <BladeModal
      open={open}
      onClose={onClose}
      title={service.name}
      subtitle={`source: ${service.source}`}
      headerBadge={
        <span className={s.badge} style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}>
          <span className={s.dot} style={{ backgroundColor: cfg.color }} />
          {HEALTH_LABELS[health].toUpperCase()}
        </span>
      }
      actions={
        <>
          <Button appearance="primary" size="small" icon={<SearchRegular />} onClick={investigate}>Investigate</Button>
          <Button size="small" icon={<ArrowResetRegular />} onClick={restart}>Restart</Button>
          <Button size="small" icon={<ArrowAutofitHeightRegular />} onClick={scale}>Scale</Button>
          <Badge appearance="tint" color="warning" title="Restart & Scale are demo-only — no live cluster mutation API is wired.">Restart / Scale: demo</Badge>
        </>
      }
    >
      <BladeSection label="Health">
        <div className={s.metrics}>
          <div className={s.metric}><span className={s.mLabel}>Status</span><span className={s.mValue} style={{ color: cfg.text }}>{HEALTH_LABELS[health]}</span></div>
          <div className={s.metric}><span className={s.mLabel}>Last Incident</span><span className={s.mValue}>{service.lastIncident ? fmt.relative(service.lastIncident) : '—'}</span></div>
        </div>
      </BladeSection>

      <BladeSection label="Metrics">
        <div className={s.metrics}>
          <div className={s.metric}><span className={s.mLabel}>Response (p99)</span><span className={s.mValue}>{Math.round(service.responseTimeMs)}ms</span></div>
          <div className={s.metric}><span className={s.mLabel}>Error Rate</span><span className={s.mValue}>{service.errorRatePct.toFixed(1)}%</span></div>
        </div>
      </BladeSection>

      <BladeSection label="Logs">
        <span className={s.muted}>
          {service.source === 'azure'
            ? 'Recent error logs stream from Log Analytics during an active investigation.'
            : 'Live logs are available when telemetry mode is Azure and the workload is deployed.'}
        </span>
      </BladeSection>

      <BladeSection label="Dependencies">
        <span className={s.muted}>Dependency mapping is derived from Application Insights once the service is instrumented.</span>
      </BladeSection>
    </BladeModal>
  )
}

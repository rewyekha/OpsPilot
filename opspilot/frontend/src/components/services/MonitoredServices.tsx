/**
 * Monitored Services — dashboard panel (Phase 8).
 *
 * Shows the health roster of every service OpsPilot monitors:
 *   • service name
 *   • health status (Healthy / Degraded / Unhealthy / Unknown)
 *   • last incident (relative time, timezone-aware via shared formatters)
 *   • response time (representative p99 latency, ms)
 *
 * Data comes from GET /api/system/services, which the backend sources from the
 * active TelemetryProvider — fixtures when TELEMETRY_MODE=synthetic, real
 * Application Insights / Log Analytics when TELEMETRY_MODE=azure. A small chip
 * surfaces which source produced the numbers.
 */
import React from 'react'
import { makeStyles, tokens, mergeClasses, Spinner } from '@fluentui/react-components'
import { ServerRegular } from '@fluentui/react-icons'
import { useMonitoredServices } from '../../hooks/useMonitoredServices'
import { useFormatters } from '../../store/PreferencesContext'
import {
  HEALTH_COLORS,
  HEALTH_LABELS,
  asHealth,
  type HealthKey,
} from '../../theme/tokens'
import type { ApiServiceHealth } from '../../api/services'

const useStyles = makeStyles({
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceChip: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '4px',
    padding: '2px 6px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  tile: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'hidden',
  },
  rail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '3px',
  },
  tileHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  icon: {
    display: 'inline-flex',
    color: tokens.colorNeutralForeground3,
    fontSize: '16px',
  },
  name: {
    fontSize: '13px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  metrics: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
  },
  metricLabel: {
    fontSize: '10px',
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },
  metricValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
  },
  healthChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '20px',
    paddingLeft: '8px',
    paddingRight: '9px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    whiteSpace: 'nowrap',
    alignSelf: 'flex-start',
  },
  dot: {
    width: '6px',
    height: '6px',
    minWidth: '6px',
    borderRadius: '50%',
  },
  empty: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    padding: '12px 0',
  },
})

const HealthChip: React.FC<{ status: HealthKey }> = ({ status }) => {
  const s = useStyles()
  const cfg = HEALTH_COLORS[status]
  return (
    <span
      className={s.healthChip}
      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      <span className={s.dot} style={{ backgroundColor: cfg.color }} />
      {HEALTH_LABELS[status].toUpperCase()}
    </span>
  )
}

const ServiceTile: React.FC<{ svc: ApiServiceHealth }> = ({ svc }) => {
  const s = useStyles()
  const fmt = useFormatters()
  const health = asHealth(svc.status)
  const cfg = HEALTH_COLORS[health]

  return (
    <div className={s.tile}>
      <span className={s.rail} style={{ backgroundColor: cfg.color }} />
      <div className={s.tileHead}>
        <span className={s.icon}>
          <ServerRegular />
        </span>
        <span className={s.name}>{svc.name}</span>
      </div>

      <HealthChip status={health} />

      <div className={s.metrics}>
        <div className={s.metric}>
          <span className={s.metricLabel}>Response</span>
          <span className={s.metricValue}>{Math.round(svc.responseTimeMs)}ms</span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Errors</span>
          <span className={s.metricValue}>{svc.errorRatePct.toFixed(1)}%</span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Last Incident</span>
          <span className={s.metricValue}>
            {svc.lastIncident ? fmt.relative(svc.lastIncident) : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

export const MonitoredServices: React.FC = () => {
  const s = useStyles()
  const { data, loading, error } = useMonitoredServices()

  return (
    <>
      <div className={s.headerRow}>
        <span className={s.sectionLabel}>Monitored Services</span>
        {data && <span className={s.sourceChip}>{data.telemetryMode}</span>}
      </div>

      {loading && <Spinner size="tiny" label="Loading services…" />}
      {error && <div className={mergeClasses(s.empty)}>Unable to load services: {error}</div>}
      {!loading && !error && data && data.services.length === 0 && (
        <div className={s.empty}>No monitored Azure services discovered</div>
      )}

      {!loading && !error && data && data.services.length > 0 && (
        <div className={s.grid}>
          {data.services.map((svc) => (
            <ServiceTile key={svc.name} svc={svc} />
          ))}
        </div>
      )}
    </>
  )
}

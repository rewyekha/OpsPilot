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
import React, { useState } from 'react'
import { makeStyles, tokens, mergeClasses, Spinner } from '@fluentui/react-components'
import { ServerRegular, ServerMultipleRegular, OpenRegular } from '@fluentui/react-icons'
import { useMonitoredServices } from '../../hooks/useMonitoredServices'
import { useActiveIncidents } from '../../hooks/useActiveIncidents'
import { useFormatters } from '../../store/PreferencesContext'
import { EmptyState } from '../shared/EmptyState'
import { ServiceBlade } from './ServiceBlade'
import { deriveServiceStatus, STATUS_STYLE, type DisplayStatus } from '../../theme/serviceStatus'
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
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
    ':hover': {
      transform: 'translateY(-2px)',
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
    },
    ':focus-visible': { outline: `2px solid ${tokens.colorBrandStroke1}`, outlineOffset: '2px' },
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
    flex: 1,
  },
  openHint: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    flexShrink: 0,
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: tokens.colorBrandForeground1,
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

const StatusChip: React.FC<{ status: DisplayStatus }> = ({ status }) => {
  const s = useStyles()
  const cfg = STATUS_STYLE[status]
  return (
    <span
      className={s.healthChip}
      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      <span className={s.dot} style={{ backgroundColor: cfg.color }} />
      {status}
    </span>
  )
}

const ServiceTile: React.FC<{ svc: ApiServiceHealth; status: DisplayStatus; onOpen: () => void }> = ({ svc, status, onOpen }) => {
  const s = useStyles()
  const fmt = useFormatters()
  const cfg = STATUS_STYLE[status]

  return (
    <div
      className={s.tile}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      aria-label={`Open ${svc.name}`}
    >
      <span className={s.rail} style={{ backgroundColor: cfg.color }} />
      <div className={s.tileHead}>
        <span className={s.icon}>
          <ServerRegular />
        </span>
        <span className={s.name}>{svc.name}</span>
        <span className={s.openHint}>Open <OpenRegular fontSize={12} /></span>
      </div>

      <StatusChip status={status} />

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
  const active = useActiveIncidents()
  const [selected, setSelected] = useState<ApiServiceHealth | null>(null)

  const incidentFor = (name: string) =>
    (active.data ?? []).find(
      (i) => (i.affected_services ?? []).includes(name) || i.id === `INC-${name}`,
    )

  return (
    <>
      <div className={s.headerRow}>
        <span className={s.sectionLabel}>Monitored Services</span>
        {data && <span className={s.sourceChip}>{data.telemetryMode}</span>}
      </div>

      {loading && <Spinner size="tiny" label="Loading services…" />}
      {error && <div className={mergeClasses(s.empty)}>Unable to load services: {error}</div>}
      {!loading && !error && data && data.services.length === 0 && (
        <EmptyState
          icon={<ServerMultipleRegular />}
          title={`Telemetry Mode: ${data.telemetryMode.charAt(0).toUpperCase()}${data.telemetryMode.slice(1)}`}
          body={
            'No Azure workloads are currently connected.\n\n' +
            'Deploy monitored workloads and enable Azure telemetry to discover live services.'
          }
        />
      )}

      {!loading && !error && data && data.services.length > 0 && (
        <div className={s.grid}>
          {data.services.map((svc) => (
            <ServiceTile
              key={svc.name}
              svc={svc}
              status={deriveServiceStatus(svc, incidentFor(svc.name))}
              onOpen={() => setSelected(svc)}
            />
          ))}
        </div>
      )}

      <ServiceBlade
        service={selected}
        incident={selected ? incidentFor(selected.name) : undefined}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  )
}

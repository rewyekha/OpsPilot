import React, { useState, useEffect } from 'react'
import { makeStyles, tokens, mergeClasses, shorthands } from '@fluentui/react-components'
import { MOCK_INCIDENT, type AffectedService } from '../../data/mockIncident'

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  // Page wrapper
  page: {
    padding: '24px',
    maxWidth: '1200px',
  },

  // ── Card shell ─────────────────────────────────────────────────────────────
  card: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: `0 0 0 1px ${tokens.colorNeutralStroke1}, 0 4px 24px rgba(0, 0, 0, 0.3)`,
  },
  // Left severity accent bar — absolutely positioned
  criticalAccent: {
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '4px',
    backgroundColor: '#dc2626',
    zIndex: 1,
    pointerEvents: 'none',
  },
  // Content shifted right of accent bar
  cardInner: {
    paddingLeft: '24px',
  },

  // ── Section separator ──────────────────────────────────────────────────────
  sep: {
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
  },

  // ── Header section ─────────────────────────────────────────────────────────
  header: {
    padding: '20px 24px 20px 0',
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  // Pulsing investigating chip
  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '4px 12px 4px 9px',
    ...shorthands.border('1px', 'solid', 'rgba(220, 38, 38, 0.35)'),
    borderRadius: '20px',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    minWidth: '7px',
    borderRadius: '50%',
    backgroundColor: '#dc2626',
    // @keyframes ops-status-pulse defined in index.html
    animationName: 'ops-status-pulse',
    animationDuration: '2s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  statusText: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.8px',
    color: '#f87171',
  },
  incidentId: {
    fontSize: '12px',
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    letterSpacing: '0.5px',
    color: tokens.colorNeutralForeground3,
  },
  // Severity row: CRITICAL badge + P1 label
  severityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  criticalBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    ...shorthands.border('1px', 'solid', 'rgba(220, 38, 38, 0.45)'),
    borderRadius: '4px',
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: '#f87171',
  },
  severityP: {
    fontSize: '12px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground3,
  },
  // Incident title + description
  title: {
    margin: '0 0 6px 0',
    padding: '0',
    fontSize: '22px',
    fontWeight: '700',
    color: tokens.colorNeutralForeground1,
    letterSpacing: '-0.4px',
    lineHeight: '1.3',
  },
  subtitle: {
    margin: '0',
    padding: '0',
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.5',
  },

  // ── Metrics row ────────────────────────────────────────────────────────────
  metricsRow: {
    display: 'flex',
    alignItems: 'stretch',
    paddingRight: '24px',
  },
  metricCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    padding: '16px 20px',
    flex: '1',
    minWidth: '0',
  },
  metricLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
  },
  metricPrimary: {
    fontSize: '15px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.3',
    whiteSpace: 'nowrap',
  },
  metricSub: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
  },
  // Vertical separator between metric cells
  metricSep: {
    width: '1px',
    backgroundColor: tokens.colorNeutralStroke1,
    flexShrink: 0,
    marginTop: '12px',
    marginBottom: '12px',
  },
  // Confidence bar layout
  confidenceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '2px',
  },
  barTrack: {
    flex: '1',
    height: '6px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    // width + backgroundColor set via inline style for transition animation
  },

  // ── Section (services + impact) ─────────────────────────────────────────────
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 24px 16px 0',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
  },

  // ── Affected service chips ──────────────────────────────────────────────────
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 12px',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  chipDot: {
    width: '7px',
    height: '7px',
    minWidth: '7px',
    borderRadius: '50%',
  },
  chipDotCritical: {
    backgroundColor: '#dc2626',
    boxShadow: '0 0 6px rgba(220, 38, 38, 0.6)',
  },
  chipDotDegraded: {
    backgroundColor: '#d97706',
    boxShadow: '0 0 6px rgba(217, 119, 6, 0.5)',
  },
  chipLabel: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground1,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    whiteSpace: 'nowrap',
  },

  // ── Impact section ─────────────────────────────────────────────────────────
  impactBarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  impactBarLabel: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
    width: '84px',
    flexShrink: 0,
  },
  impactPct: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f87171',
    width: '36px',
    textAlign: 'right',
    flexShrink: 0,
  },
  // Business impact figure row
  impactFigure: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    paddingTop: '14px',
    marginTop: '4px',
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
  },
  impactAmount: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f87171',
    letterSpacing: '-0.5px',
    lineHeight: '1',
  },
  impactMeta: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
  },
})

// ── Internal sub-components ───────────────────────────────────────────────────

const MetricCell: React.FC<{ label: string; primary: string; sub?: string }> = ({
  label,
  primary,
  sub,
}) => {
  const s = useStyles()
  return (
    <div className={s.metricCell}>
      <span className={s.metricLabel}>{label}</span>
      <span className={s.metricPrimary}>{primary}</span>
      {sub && <span className={s.metricSub}>{sub}</span>}
    </div>
  )
}

const ConfidenceCell: React.FC<{ confidence: number; mounted: boolean }> = ({
  confidence,
  mounted,
}) => {
  const s = useStyles()
  return (
    <div className={s.metricCell}>
      <span className={s.metricLabel}>Confidence Score</span>
      <div className={s.confidenceRow}>
        <div className={s.barTrack}>
          <div
            className={s.barFill}
            style={{
              width: mounted ? `${confidence}%` : '0%',
              backgroundColor: tokens.colorBrandBackground,
              transition: 'width 1.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
        <span className={s.metricPrimary}>{confidence}%</span>
      </div>
    </div>
  )
}

const ServiceChip: React.FC<{ svc: AffectedService }> = ({ svc }) => {
  const s = useStyles()
  const dotClass =
    svc.status === 'critical'
      ? mergeClasses(s.chipDot, s.chipDotCritical)
      : mergeClasses(s.chipDot, s.chipDotDegraded)
  return (
    <div className={s.chip}>
      <div className={dotClass} />
      <span className={s.chipLabel}>{svc.name}</span>
    </div>
  )
}

// ── IncidentPanel (exported) ──────────────────────────────────────────────────

export const IncidentPanel: React.FC = () => {
  const s = useStyles()
  const incident = MOCK_INCIDENT

  // Trigger bar fill animations after first paint
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className={s.page}>
      <div className={s.card}>
        {/* Left severity accent */}
        <div className={s.criticalAccent} />

        <div className={s.cardInner}>
          {/* ── Header ───────────────────────────────────────────────── */}
          <div className={s.header}>
            {/* Status chip + Incident ID */}
            <div className={s.headerTopRow}>
              <div className={s.statusChip}>
                <div className={s.statusDot} />
                <span className={s.statusText}>{incident.statusLabel.toUpperCase()}</span>
              </div>
              <span className={s.incidentId}>{incident.id}</span>
            </div>

            {/* Severity badge + P-level */}
            <div className={s.severityRow}>
              <span className={s.criticalBadge}>{incident.severityLabel}</span>
              <span className={s.severityP}>{incident.severity}</span>
            </div>

            {/* Title + description */}
            <h1 className={s.title}>{incident.title}</h1>
            <p className={s.subtitle}>{incident.description}</p>
          </div>

          {/* ── Metrics row ──────────────────────────────────────────── */}
          <div className={s.sep} />
          <div className={s.metricsRow}>
            <MetricCell
              label="Started"
              primary={incident.startedDisplay}
              sub="Incident opened"
            />
            <div className={s.metricSep} />
            <MetricCell
              label="Duration"
              primary={incident.investigationDuration}
              sub="Investigation active"
            />
            <div className={s.metricSep} />
            <MetricCell
              label="Blast Radius"
              primary={`${incident.blastRadius} services`}
              sub={`~${(incident.affectedUsers / 1000).toFixed(0)}K users`}
            />
            <div className={s.metricSep} />
            <ConfidenceCell confidence={incident.confidence} mounted={mounted} />
          </div>

          {/* ── Affected services ────────────────────────────────────── */}
          <div className={s.sep} />
          <div className={s.section}>
            <span className={s.sectionLabel}>Affected Services</span>
            <div className={s.chipsRow}>
              {incident.affectedServices.map((svc) => (
                <ServiceChip key={svc.name} svc={svc} />
              ))}
            </div>
          </div>

          {/* ── Current impact ───────────────────────────────────────── */}
          <div className={s.sep} />
          <div className={s.section}>
            <span className={s.sectionLabel}>Current Impact</span>

            <div className={s.impactBarRow}>
              <span className={s.impactBarLabel}>Error Rate</span>
              <div className={s.barTrack} style={{ flex: 1 }}>
                <div
                  className={s.barFill}
                  style={{
                    width: mounted ? `${incident.errorRate}%` : '0%',
                    backgroundColor: '#dc2626',
                    transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </div>
              <span className={s.impactPct}>{incident.errorRate}%</span>
            </div>

            <div className={s.impactFigure}>
              <span className={s.impactAmount}>
                ${incident.businessImpactPerHour.toLocaleString()}
              </span>
              <span className={s.impactMeta}>/ hour estimated business loss</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { makeStyles, tokens, mergeClasses, shorthands } from '@fluentui/react-components'
import { useTimeline } from '../../hooks/useTimeline'
import type { ApiTimelineEvent } from '../../api/timeline'
import { useIncidentStream } from '../../hooks/useIncidentStream'
import { StreamStatusBadge } from '../shared/StreamStatusBadge'
import { useSession, type SessionTimelineEvent } from '../../store/SessionContext'

// ── Local types ────────────────────────────────────────────────────────────────

type TimelineEventType =
  | 'deployment'
  | 'incident'
  | 'detection'
  | 'correlation'
  | 'root_cause'

interface TimelineEvent {
  id: string
  timestamp: string
  type: TimelineEventType
  title: string
  description: string
  source: string
  confidence: number
  isKeyEvent?: boolean
}

// ── Mapping helpers ────────────────────────────────────────────────────────────

const AGENT_ROLE_NAMES: Record<string, string> = {
  commander:    'Commander Agent',
  metrics:      'Metrics Agent',
  logs:         'Logs Agent',
  deployment:   'Deployment Agent',
  time_machine: 'Time Machine Agent',
}

function formatUtcTimestamp(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} UTC`
}

function normaliseType(t: string): TimelineEventType {
  const valid: TimelineEventType[] = [
    'deployment', 'incident', 'detection', 'correlation', 'root_cause',
  ]
  return valid.includes(t as TimelineEventType) ? (t as TimelineEventType) : 'detection'
}

function mapApiEvent(e: ApiTimelineEvent): TimelineEvent {
  return {
    id: e.id,
    timestamp: formatUtcTimestamp(e.timestamp),
    type: normaliseType(e.type),
    title: e.title,
    description: e.description,
    source: e.agent_role ? (AGENT_ROLE_NAMES[e.agent_role] ?? e.type_label) : e.type_label,
    confidence: e.confidence,
    isKeyEvent: e.is_key_event,
  }
}

// Session (operator-initiated) events overlay onto the same timeline.
const SESSION_KIND_TYPE: Record<SessionTimelineEvent['kind'], TimelineEventType> = {
  action_submitted: 'deployment',
  action_succeeded: 'deployment',
  action_failed: 'incident',
  investigation_created: 'detection',
  state_transition: 'correlation',
}

function mapSessionEvent(e: SessionTimelineEvent): TimelineEvent {
  return {
    id: e.id,
    timestamp: formatUtcTimestamp(e.timestamp),
    type: SESSION_KIND_TYPE[e.kind],
    title: e.title,
    description: e.description,
    source: e.source,
    confidence: e.confidence,
    isKeyEvent: e.kind === 'action_succeeded',
  }
}

// ── Event type display config ─────────────────────────────────────────────────

interface EventCfg {
  label: string
  color: string
  chipBg: string
  chipBorder: string
  textColor: string
}

const EVENT_CFG: Record<TimelineEventType, EventCfg> = {
  deployment: {
    label: 'DEPLOYMENT',
    color: '#d97706',
    chipBg: 'rgba(217, 119, 6, 0.1)',
    chipBorder: 'rgba(217, 119, 6, 0.35)',
    textColor: '#fbbf24',
  },
  incident: {
    label: 'INCIDENT',
    color: '#dc2626',
    chipBg: 'rgba(220, 38, 38, 0.1)',
    chipBorder: 'rgba(220, 38, 38, 0.35)',
    textColor: '#f87171',
  },
  detection: {
    label: 'DETECTION',
    color: '#2563eb',
    chipBg: 'rgba(37, 99, 235, 0.1)',
    chipBorder: 'rgba(37, 99, 235, 0.35)',
    textColor: '#60a5fa',
  },
  correlation: {
    label: 'CORRELATION',
    color: '#7c3aed',
    chipBg: 'rgba(124, 58, 237, 0.1)',
    chipBorder: 'rgba(124, 58, 237, 0.35)',
    textColor: '#a78bfa',
  },
  root_cause: {
    label: 'ROOT CAUSE',
    color: '#eab308',
    chipBg: 'rgba(234, 179, 8, 0.12)',
    chipBorder: 'rgba(234, 179, 8, 0.4)',
    textColor: '#fcd34d',
  },
}

// Stats-row colors per type
const STAT_COLORS: Record<TimelineEventType, string> = {
  deployment:  '#fbbf24',
  incident:    '#f87171',
  detection:   '#60a5fa',
  correlation: '#a78bfa',
  root_cause:  '#fcd34d',
}

const confColor = (c: number): string => {
  if (c >= 90) return '#4ade80'
  if (c >= 75) return '#3b82f6'
  return '#f59e0b'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  // Page wrapper
  page: {
    padding: '24px',
  },

  // ── Panel shell ─────────────────────────────────────────────────────────────
  panel: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: `0 0 0 1px ${tokens.colorNeutralStroke1}, 0 4px 24px rgba(0, 0, 0, 0.3)`,
  },

  // ── Panel header ────────────────────────────────────────────────────────────
  panelHeader: {
    padding: '18px 20px 0 20px',
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '5px',
  },
  panelLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontFamily: '"Cascadia Code", "Consolas", monospace',
  },
  eventCountBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    borderRadius: '20px',
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: '11px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground2,
  },
  incidentTitle: {
    margin: '0 0 4px 0',
    padding: '0',
    fontSize: '16px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
  },
  timeRange: {
    margin: '0 0 14px 0',
    padding: '0',
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
  },

  // ── Stats row ───────────────────────────────────────────────────────────────
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    paddingTop: '12px',
    paddingBottom: '12px',
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '700',
    lineHeight: '1',
    color: tokens.colorNeutralForeground1,
  },
  statLabel: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: tokens.colorNeutralStroke1,
    flexShrink: 0,
  },

  // ── Timeline body (scrollable) ───────────────────────────────────────────────
  timelineBody: {
    padding: '24px 20px 12px 20px',
    overflowY: 'auto',
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
  },

  // ── Timeline item ────────────────────────────────────────────────────────────
  // The left border-left IS the visual timeline line.
  // Dots are absolutely positioned, centered on that border.
  timelineItem: {
    position: 'relative',
    paddingLeft: '28px',   // 8px dot overlap + 7px gap
    paddingBottom: '16px',
    ...shorthands.borderLeft('2px', 'solid', tokens.colorNeutralStroke2),
  },
  // Last item: hide the connecting line below it
  timelineItemLast: {
    borderLeftColor: 'transparent',
    paddingBottom: '4px',
  },

  // ── Node dots ────────────────────────────────────────────────────────────────
  // Centered on the 2px border-left: left = -(dotRadius) - 1 = -8px
  nodeDot: {
    position: 'absolute',
    left: '-8px',
    top: '5px',
    width: '14px',
    height: '14px',
    minWidth: '14px',
    borderRadius: '50%',
    zIndex: 1,
    // backgroundColor set via inline style
  },
  // Root cause / key event: larger dot with glow — left re-centered at -10px
  nodeDotKey: {
    left: '-10px',
    top: '3px',
    width: '18px',
    height: '18px',
    // boxShadow set via inline style
  },

  // ── Event card ───────────────────────────────────────────────────────────────
  eventCard: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '6px',
    overflow: 'hidden',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
  },
  eventCardKey: {
    ...shorthands.border('1px', 'solid', 'rgba(234, 179, 8, 0.4)'),
    backgroundColor: 'rgba(234, 179, 8, 0.04)',
  },
  // Left accent bar — color via inline style
  eventAccent: {
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '3px',
    zIndex: 1,
    pointerEvents: 'none',
  },
  eventContent: {
    paddingTop: '12px',
    paddingRight: '14px',
    paddingBottom: '12px',
    paddingLeft: '16px',
  },

  // ── Event header: type badge + timestamp ─────────────────────────────────────
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '7px',
  },
  timestamp: {
    fontSize: '11px',
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },

  // ── Event title & description ─────────────────────────────────────────────────
  eventTitle: {
    margin: '0 0 5px 0',
    padding: '0',
    fontSize: '14px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.3',
  },
  eventTitleKey: {
    fontSize: '15px',
    color: '#fcd34d',
  },
  eventDesc: {
    margin: '0 0 10px 0',
    padding: '0',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.6',
  },

  // ── Event footer: source + confidence bar ────────────────────────────────────
  eventFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  sourceLabel: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
  },
  sourceName: {
    fontWeight: '500',
    color: tokens.colorNeutralForeground2,
  },
  confidenceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  barTrack: {
    width: '56px',
    height: '4px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '2px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  barFill: {
    height: '100%',
    borderRadius: '2px',
    // width + backgroundColor via inline style for animation
  },
  confValue: {
    fontSize: '11px',
    fontWeight: '600',
    width: '34px',
    textAlign: 'right',
    flexShrink: 0,
  },

  // ── Loading skeleton ────────────────────────────────────────────────────────
  skeletonLine: {
    height: '13px',
    borderRadius: '4px',
    backgroundColor: tokens.colorNeutralBackground4,
    animationName: 'ops-status-pulse',
    animationDuration: '1.8s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  skeletonBlock: {
    height: '100px',
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground4,
    animationName: 'ops-status-pulse',
    animationDuration: '1.8s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },

  // ── Error card ──────────────────────────────────────────────────────────────
  errorCard: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: `0 0 0 1px rgba(220, 38, 38, 0.35), 0 4px 24px rgba(0, 0, 0, 0.3)`,
  },
  errorAccent: {
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '4px',
    backgroundColor: '#dc2626',
    zIndex: 1,
    pointerEvents: 'none',
  },
  errorContent: {
    padding: '20px 20px 20px 24px',
  },
  errorTitle: {
    margin: '0 0 6px 0',
    padding: '0',
    fontSize: '13px',
    fontWeight: '700',
    color: '#f87171',
  },
  errorMessage: {
    margin: '0',
    padding: '0',
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
  },

  // ── SSE new-event slide-in ──────────────────────────────────────────────────────
  // Uses the global ops-status-pulse keyframe (opacity 1→0.4→1) for a brief
  // highlight; the event then fades to the normal card style.
  newEvent: {
    animationName: 'ops-status-pulse',
    animationDuration: '1.6s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: '1',
    animationFillMode: 'forwards',
  },
})

// ── TimelineEventRow ──────────────────────────────────────────────────────────

const TimelineEventRow: React.FC<{
  event: TimelineEvent
  isLast: boolean
  mounted: boolean
}> = ({ event, isLast, mounted }) => {
  const s = useStyles()
  const cfg = EVENT_CFG[event.type]

  return (
    <div className={mergeClasses(s.timelineItem, isLast ? s.timelineItemLast : undefined)}>
      {/* Node dot — centered on the border-left line */}
      <div
        className={mergeClasses(s.nodeDot, event.isKeyEvent ? s.nodeDotKey : undefined)}
        style={{
          backgroundColor: cfg.color,
          boxShadow: event.isKeyEvent ? '0 0 14px rgba(234, 179, 8, 0.55)' : undefined,
        }}
      />

      {/* Event card */}
      <div className={mergeClasses(s.eventCard, event.isKeyEvent ? s.eventCardKey : undefined)}>
        {/* Left accent bar in event type color */}
        <div className={s.eventAccent} style={{ backgroundColor: cfg.color }} />

        <div className={s.eventContent}>
          {/* Header: type badge + timestamp */}
          <div className={s.eventHeader}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                border: `1px solid ${cfg.chipBorder}`,
                borderRadius: '4px',
                backgroundColor: cfg.chipBg,
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.8px',
                color: cfg.textColor,
                flexShrink: 0,
              }}
            >
              {cfg.label}
            </div>
            <span className={s.timestamp}>{event.timestamp}</span>
          </div>

          {/* Title */}
          <h3 className={mergeClasses(s.eventTitle, event.isKeyEvent ? s.eventTitleKey : undefined)}>
            {event.title}
          </h3>

          {/* Description */}
          <p className={s.eventDesc}>{event.description}</p>

          {/* Footer: source attribution + confidence bar */}
          <div className={s.eventFooter}>
            <span className={s.sourceLabel}>
              Source: <span className={s.sourceName}>{event.source}</span>
            </span>
            <div className={s.confidenceRow}>
              <div className={s.barTrack}>
                <div
                  className={s.barFill}
                  style={{
                    width: mounted ? `${event.confidence}%` : '0%',
                    backgroundColor: confColor(event.confidence),
                    transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </div>
              <span className={s.confValue} style={{ color: confColor(event.confidence) }}>
                {event.confidence}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── InvestigationTimelinePanel ────────────────────────────────────────────────

export const InvestigationTimelinePanel: React.FC = () => {
  const s = useStyles()
  const { data, loading, error } = useTimeline('INC-2024-0847')
  const { status: streamStatus, lastEvent } = useIncidentStream('INC-2024-0847')
  const { timelineEvents: sessionEvents } = useSession()

  // ── Live event list — starts as the HTTP snapshot, new events appended by SSE
  const [liveEvents, setLiveEvents] = useState<TimelineEvent[]>([])
  // IDs of events added via SSE (used to apply highlight animation once)
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (data) setLiveEvents(data.events.map(mapApiEvent))
  }, [data])

  useEffect(() => {
    if (!lastEvent) return
    // Map SSE events that have a meaningful timeline representation
    let syntheticType: TimelineEvent['type'] | null = null
    let syntheticTitle = ''
    let syntheticDesc = ''
    let syntheticConf = 0
    let isKey = false

    if (lastEvent.event_type === 'root_cause.updated') {
      const confidence = lastEvent.payload.confidence as number ?? 0
      const title = lastEvent.payload.title as string ?? 'Root Cause Updated'
      syntheticType = 'root_cause'
      syntheticTitle = title
      syntheticDesc = `Confidence updated to ${confidence}%`
      syntheticConf = confidence
      isKey = true
    } else if (lastEvent.event_type === 'investigation.complete') {
      const summary = lastEvent.payload.summary as string ?? 'Investigation complete'
      syntheticType = 'correlation'
      syntheticTitle = 'Investigation Complete'
      syntheticDesc = summary
      syntheticConf = 100
      isKey = true
    } else if (lastEvent.event_type === 'agent.finding') {
      const confidence = lastEvent.payload.confidence as number ?? 0
      const summary = lastEvent.payload.summary as string ?? ''
      syntheticType = 'detection'
      syntheticTitle = `${lastEvent.agent_name} Agent Finding`
      syntheticDesc = summary
      syntheticConf = confidence
      isKey = false
    }

    if (syntheticType === null) return

    const newId = `sse-${lastEvent.event_type}-${lastEvent.timestamp}`
    setLiveEvents((prev) => {
      // Deduplicate by id
      if (prev.some((e) => e.id === newId)) return prev
      const event: TimelineEvent = {
        id: newId,
        timestamp: formatUtcTimestamp(lastEvent.timestamp),
        type: syntheticType!,
        title: syntheticTitle,
        description: syntheticDesc,
        source: AGENT_ROLE_NAMES[lastEvent.agent_name] ?? lastEvent.agent_name,
        confidence: syntheticConf,
        isKeyEvent: isKey,
      }
      return [...prev, event]
    })
    setNewEventIds((prev) => new Set([...prev, newId]))
    // Remove highlight after animation completes
    setTimeout(() => {
      setNewEventIds((prev) => {
        const next = new Set(prev)
        next.delete(newId)
        return next
      })
    }, 2000)
  }, [lastEvent])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.panel} style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={s.skeletonLine} style={{ width: '50%' }} />
            <div className={s.skeletonLine} style={{ width: '30%' }} />
            <div className={s.skeletonBlock} />
            <div className={s.skeletonBlock} />
            <div className={s.skeletonBlock} />
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className={s.page}>
        <div className={s.errorCard}>
          <div className={s.errorAccent} />
          <div className={s.errorContent}>
            <p className={s.errorTitle}>Failed to load timeline</p>
            <p className={s.errorMessage}>{error ?? 'No data available'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Operator-initiated session events (executions, new investigations) overlay
  // onto the API/SSE timeline so the view updates immediately after execution.
  const events = [...liveEvents, ...sessionEvents.map(mapSessionEvent)]
  const byType = (t: TimelineEventType) => events.filter((e) => e.type === t).length

  // Build time range string from first/last events
  const timeRange =
    data !== null && data.events.length >= 2
      ? (() => {
          const first = new Date(data.events[0].timestamp)
          const last = new Date(data.events[data.events.length - 1].timestamp)
          const diffMin = Math.round((last.getTime() - first.getTime()) / 60000)
          const fmtTime = (d: Date) =>
            `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
          return `${fmtTime(first)} — ${fmtTime(last)} · ${diffMin} min total investigation`
        })()
      : ''

  const STAT_ITEMS: Array<{ type: TimelineEventType; label: string }> = [
    { type: 'deployment',  label: 'Deployment'  },
    { type: 'incident',    label: 'Incident'    },
    { type: 'detection',   label: 'Detections'  },
    { type: 'correlation', label: 'Correlations' },
    { type: 'root_cause',  label: 'Root Cause'  },
  ]

  return (
    <div className={s.page}>
      <div className={s.panel}>
        {/* ── Panel header ─────────────────────────────────────────────── */}
        <div className={s.panelHeader}>
          <div className={s.headerTopRow}>
            <span className={s.panelLabel}>Investigation Timeline · {data?.incident_id ?? 'INC-2024-0847'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={s.eventCountBadge}>{events.length} events</div>
              <StreamStatusBadge status={streamStatus} />
            </div>
          </div>

          <p className={s.incidentTitle}>Checkout Service Failure</p>
          <p className={s.timeRange}>{timeRange}</p>

          {/* Event type counts */}
          <div className={s.statsRow}>
            {STAT_ITEMS.map((item, idx) => (
              <React.Fragment key={item.type}>
                {idx > 0 && <div className={s.statDivider} />}
                <div className={s.statItem}>
                  <span className={s.statValue} style={{ color: STAT_COLORS[item.type] }}>
                    {byType(item.type)}
                  </span>
                  <span className={s.statLabel}>{item.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Timeline body ─────────────────────────────────────────────── */}
        <div className={s.timelineBody}>
          {events.map((event, idx) => (
            <div
              key={event.id}
              className={newEventIds.has(event.id) ? s.newEvent : undefined}
            >
              <TimelineEventRow
                event={event}
                isLast={idx === events.length - 1}
                mounted={mounted}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

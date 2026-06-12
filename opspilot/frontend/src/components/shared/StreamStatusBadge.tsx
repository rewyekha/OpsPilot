/**
 * StreamStatusBadge — displays the live investigation SSE stream status.
 * Used in panel headers alongside the existing panel label row.
 *
 * Shows:  ● CONNECTED | ○~ RECONNECTING | ○ DISCONNECTED | ○ STANDBY
 *
 * `idle`/STANDBY is distinct from `disconnected`: it means there is simply no
 * active investigation to stream (a healthy idle system), NOT a dropped stream.
 * Conflating the two made an idle dashboard show an alarming red "DISCONNECTED".
 */
import React from 'react'
import { makeStyles } from '@fluentui/react-components'

/** Statuses this badge can render — a superset of the stream hook's union. */
export type StreamBadgeStatus = 'connected' | 'reconnecting' | 'disconnected' | 'idle'

interface StatusCfgEntry {
  color: string
  bg: string
  border: string
  label: string
  title: string
  pulse: boolean
}

const STATUS_CFG: Record<StreamBadgeStatus, StatusCfgEntry> = {
  connected: {
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.35)',
    label: 'CONNECTED',
    title: 'Live investigation stream connected',
    pulse: false,
  },
  reconnecting: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.35)',
    label: 'RECONNECTING',
    title: 'Reconnecting to the live investigation stream…',
    pulse: true,
  },
  disconnected: {
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.1)',
    border: 'rgba(220, 38, 38, 0.35)',
    label: 'DISCONNECTED',
    title: 'Live investigation stream disconnected',
    pulse: false,
  },
  idle: {
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.1)',
    border: 'rgba(148, 163, 184, 0.3)',
    label: 'STANDBY',
    title: 'No active investigation — live stream on standby',
    pulse: false,
  },
}

const useStyles = makeStyles({
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    borderRadius: '20px',
    flexShrink: 0,
  },
  dot: {
    width: '6px',
    height: '6px',
    minWidth: '6px',
    borderRadius: '50%',
  },
  dotPulse: {
    width: '6px',
    height: '6px',
    minWidth: '6px',
    borderRadius: '50%',
    // @keyframes ops-status-pulse defined in index.html
    animationName: 'ops-status-pulse',
    animationDuration: '1.5s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  label: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
  },
})

export const StreamStatusBadge: React.FC<{ status: StreamBadgeStatus }> = ({ status }) => {
  const s = useStyles()
  const cfg = STATUS_CFG[status]
  return (
    <div
      className={s.badge}
      title={cfg.title}
      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <div
        className={cfg.pulse ? s.dotPulse : s.dot}
        style={{ backgroundColor: cfg.color }}
      />
      <span className={s.label} style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  )
}

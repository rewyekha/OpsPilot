/**
 * StreamStatusBadge — displays SSE connection status.
 * Used in panel headers alongside the existing panel label row.
 *
 * Shows:  ● CONNECTED | ○~ RECONNECTING | ○ DISCONNECTED
 */
import React from 'react'
import { makeStyles } from '@fluentui/react-components'
import type { ConnectionStatus } from '../../hooks/useIncidentStream'

interface StatusCfgEntry {
  color: string
  bg: string
  border: string
  label: string
  pulse: boolean
}

const STATUS_CFG: Record<ConnectionStatus, StatusCfgEntry> = {
  connected: {
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.35)',
    label: 'CONNECTED',
    pulse: false,
  },
  reconnecting: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.35)',
    label: 'RECONNECTING',
    pulse: true,
  },
  disconnected: {
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.1)',
    border: 'rgba(220, 38, 38, 0.35)',
    label: 'DISCONNECTED',
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

export const StreamStatusBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const s = useStyles()
  const cfg = STATUS_CFG[status]
  return (
    <div
      className={s.badge}
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

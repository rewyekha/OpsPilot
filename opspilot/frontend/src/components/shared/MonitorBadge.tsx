/**
 * MonitorBadge — live indicator for the autonomous incident-detection monitor.
 * Reads /api/system/monitor and refreshes on the silent `opspilot:poll`. Shows
 * green/active when the background monitor is scanning Azure telemetry.
 */
import React, { useEffect, useState } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import { systemApi, type MonitorStatus } from '../../api/system'
import { useMountLog } from '../../utils/debugMountLog' // TEMP-DEBUG

const useStyles = makeStyles({
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: '7px', height: '24px',
    padding: '0 11px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2, color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
  },
  dot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
})

export const MonitorBadge: React.FC = () => {
  const s = useStyles()
  useMountLog('MonitorBadge') // TEMP-DEBUG
  const [m, setM] = useState<MonitorStatus | null>(null)

  useEffect(() => {
    let on = true
    const load = () => systemApi.monitor().then((d) => { if (on) setM(d) }).catch(() => {})
    load()
    window.addEventListener('opspilot:poll', load)
    return () => { on = false; window.removeEventListener('opspilot:poll', load) }
  }, [])

  const active = !!m && m.enabled && m.running && m.telemetry_mode === 'azure'
  const color = active ? '#22c55e' : '#64748b'
  const label = !m
    ? 'Autonomous detection…'
    : active
      ? `Autonomous detection active · scanning every ${m.interval_seconds}s`
      : m.enabled
        ? `Autonomous detection idle (${m.telemetry_mode})`
        : 'Autonomous detection off'

  return (
    <span
      className={s.badge}
      title={m?.last_error ? `last scan error: ${m.last_error}` : 'Background monitor scans Azure telemetry and auto-investigates incidents'}
    >
      <span className={s.dot} style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

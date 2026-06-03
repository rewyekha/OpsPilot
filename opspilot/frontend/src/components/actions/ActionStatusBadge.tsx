/**
 * ActionStatusBadge — live status chip for a remediation execution job.
 *
 * Reads from SessionContext job status. Submitting/running pulse; succeeded and
 * failed are steady. Colors come from the shared severity scale.
 */
import React from 'react'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { SEVERITY_COLORS, type ColorCfg } from '../../theme/tokens'
import type { JobStatus } from '../../store/SessionContext'

const STATUS_MAP: Record<JobStatus, { cfg: ColorCfg; label: string; pulse: boolean }> = {
  submitting: { cfg: SEVERITY_COLORS.info, label: 'Submitting', pulse: true },
  running: { cfg: SEVERITY_COLORS.warning, label: 'Running', pulse: true },
  succeeded: { cfg: SEVERITY_COLORS.success, label: 'Succeeded', pulse: false },
  failed: { cfg: SEVERITY_COLORS.critical, label: 'Failed', pulse: false },
}

const useStyles = makeStyles({
  chip: {
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
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  dot: { width: '6px', height: '6px', minWidth: '6px', borderRadius: '50%' },
  pulse: {
    animationName: 'ops-status-pulse',
    animationDuration: '1.5s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
})

export const ActionStatusBadge: React.FC<{ status: JobStatus }> = ({ status }) => {
  const s = useStyles()
  const { cfg, label, pulse } = STATUS_MAP[status]
  return (
    <span
      className={s.chip}
      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      <span
        className={mergeClasses(s.dot, pulse && s.pulse)}
        style={{ backgroundColor: cfg.color }}
      />
      {label}
    </span>
  )
}

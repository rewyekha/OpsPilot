/**
 * ConfidenceBar — reusable animated confidence meter (score expressed 0–100).
 *
 * Previously every panel hand-rolled its own track/fill markup with inline
 * width transitions. This consolidates it. Color follows the shared
 * confidenceColor() ramp so green/blue/amber/red thresholds are uniform.
 */
import React, { useEffect, useState } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import { confidenceColor } from '../../theme/tokens'

const useStyles = makeStyles({
  root: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%' },
  track: {
    flex: 1,
    height: '6px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  value: {
    fontSize: '13px',
    fontWeight: 700,
    width: '42px',
    textAlign: 'right',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
})

export interface ConfidenceBarProps {
  /** Confidence score, 0–100. */
  value: number
  /** Animate the fill from 0 on mount. Default true. */
  animate?: boolean
  /** Show the numeric "NN%" label. Default true. */
  showValue?: boolean
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  value,
  animate = true,
  showValue = true,
}) => {
  const s = useStyles()
  const [width, setWidth] = useState(animate ? 0 : value)

  useEffect(() => {
    if (!animate) {
      setWidth(value)
      return
    }
    const id = requestAnimationFrame(() => setWidth(value))
    return () => cancelAnimationFrame(id)
  }, [value, animate])

  const color = confidenceColor(value)

  return (
    <div className={s.root}>
      <div className={s.track}>
        <div className={s.fill} style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      {showValue && (
        <span className={s.value} style={{ color }}>
          {Math.round(value)}%
        </span>
      )}
    </div>
  )
}

/**
 * Tiny, dependency-free chart kit (SVG/CSS) for the Analytics page.
 *
 * Intentionally avoids pulling in a charting library: these executive views need
 * only horizontal bars, a vertical column series, and a distribution/stacked bar.
 * All are driven by real computed data — callers pass `[]` to get the empty look.
 */
import React from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  hbarRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  hbarLabel: {
    width: '120px',
    flexShrink: 0,
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  hbarTrack: {
    position: 'relative',
    flex: 1,
    height: '20px',
    borderRadius: '4px',
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: 'hidden',
  },
  hbarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: '4px',
    transition: 'width 500ms ease',
    minWidth: '2px',
  },
  hbarValue: {
    width: '52px',
    flexShrink: 0,
    textAlign: 'right',
    fontSize: '12px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: tokens.colorNeutralForeground1,
  },
  columns: { display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', paddingTop: '8px' },
  col: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' },
  colBarWrap: { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  colBar: {
    width: '60%',
    minWidth: '14px',
    maxWidth: '40px',
    borderRadius: '4px 4px 0 0',
    backgroundColor: tokens.colorBrandBackground,
    transition: 'height 500ms ease',
  },
  colLabel: { fontSize: '10px', color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap' },
  colValue: { fontSize: '11px', fontWeight: 600, color: tokens.colorNeutralForeground1 },
  stack: { display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' },
  stackSeg: { transition: 'width 500ms ease' },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: tokens.colorNeutralForeground2 },
  legendDot: { width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0 },
})

export interface BarDatum {
  label: string
  value: number
  color?: string
  /** Optional display override (e.g. "1h 03m" for a duration). */
  display?: string
}

/** Horizontal bar chart — good for "by agent" / ranked comparisons. */
export const HBarChart: React.FC<{ data: BarDatum[]; unit?: string }> = ({ data, unit }) => {
  const s = useStyles()
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div>
      {data.map((d) => (
        <div className={s.hbarRow} key={d.label}>
          <span className={s.hbarLabel} title={d.label}>{d.label}</span>
          <div className={s.hbarTrack}>
            <div
              className={s.hbarFill}
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? tokens.colorBrandBackground,
              }}
            />
          </div>
          <span className={s.hbarValue}>{d.display ?? `${d.value}${unit ?? ''}`}</span>
        </div>
      ))}
    </div>
  )
}

/** Vertical column series — good for "per day" time series. */
export const ColumnChart: React.FC<{ data: BarDatum[] }> = ({ data }) => {
  const s = useStyles()
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className={s.columns}>
      {data.map((d) => (
        <div className={s.col} key={d.label}>
          <span className={s.colValue}>{d.display ?? d.value}</span>
          <div className={s.colBarWrap}>
            <div
              className={s.colBar}
              style={{
                height: `${Math.max(2, (d.value / max) * 100)}%`,
                backgroundColor: d.color ?? tokens.colorBrandBackground,
              }}
            />
          </div>
          <span className={s.colLabel}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Stacked distribution bar + legend — good for severity / action-type splits. */
export const DistributionBar: React.FC<{ data: BarDatum[] }> = ({ data }) => {
  const s = useStyles()
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div>
      <div className={s.stack}>
        {total > 0 &&
          data.map((d) => (
            <div
              key={d.label}
              className={s.stackSeg}
              style={{
                width: `${(d.value / total) * 100}%`,
                backgroundColor: d.color ?? tokens.colorBrandBackground,
              }}
              title={`${d.label}: ${d.value}`}
            />
          ))}
      </div>
      <div className={s.legend}>
        {data.map((d) => (
          <span className={s.legendItem} key={d.label}>
            <span className={s.legendDot} style={{ backgroundColor: d.color ?? tokens.colorBrandBackground }} />
            {d.label} · <strong>{d.value}</strong>
            {total > 0 && <span style={{ color: tokens.colorNeutralForeground4 }}>({Math.round((d.value / total) * 100)}%)</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

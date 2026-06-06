/**
 * AnalyticsBlade — the "Open Analytics" modal.
 *
 * Consumes the SAME backend analytics endpoint as the Analytics page
 * (GET /api/analytics via useAnalytics) — a single source of truth. No in-session
 * calculations. Condensed executive view (MTTR, agent accuracy, incident trends,
 * root-cause distribution) computed from real stored investigations.
 */
import React, { useMemo } from 'react'
import { makeStyles, tokens, Button, Spinner } from '@fluentui/react-components'
import { DataPieRegular } from '@fluentui/react-icons'
import { BladeModal, BladeSection } from '../shared/BladeModal'
import { ColumnChart, DistributionBar, type BarDatum } from './charts'
import { useAnalytics } from '../../hooks/useInsights'
import { confidenceColor, SEVERITY_COLORS, RISK_COLORS } from '../../theme/tokens'
import { formatDuration } from '../../utils/formatters'
import { EmptyState } from '../shared/EmptyState'

const useStyles = makeStyles({
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' },
  stat: { display: 'flex', flexDirection: 'column', gap: '3px' },
  statLabel: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  statValue: { fontSize: '20px', fontWeight: 700, color: tokens.colorNeutralForeground1 },
  center: { display: 'flex', justifyContent: 'center', padding: '24px' },
})

const PALETTE = [SEVERITY_COLORS.critical.color, SEVERITY_COLORS.warning.color, SEVERITY_COLORS.info.color, RISK_COLORS.safe.color]

export const AnalyticsBlade: React.FC<{ open: boolean; onClose: () => void; onOpenFull?: () => void }> = ({ open, onClose, onOpenFull }) => {
  const s = useStyles()
  const { data, loading } = useAnalytics()

  const trends: BarDatum[] = useMemo(
    () => (data?.investigation_volume ?? []).map((v) => ({ label: v.label, value: v.count })),
    [data],
  )
  const distribution: BarDatum[] = useMemo(() => {
    const d = data?.root_cause_categories ?? {}
    return Object.entries(d).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))
  }, [data])

  return (
    <BladeModal
      open={open}
      onClose={onClose}
      title="Analytics"
      subtitle="Executive overview"
      headerBadge={<DataPieRegular />}
      actions={onOpenFull && <Button appearance="primary" size="small" onClick={() => { onOpenFull(); onClose() }}>Open Full Analytics</Button>}
    >
      {loading ? (
        <div className={s.center}><Spinner size="tiny" label="Loading analytics…" /></div>
      ) : !data?.has_data ? (
        <EmptyState icon={<DataPieRegular />} title="No analytics available yet" body="Run an investigation — analytics are computed from real completed investigations." />
      ) : (
        <>
          <BladeSection label="Key Metrics">
            <div className={s.stats}>
              <div className={s.stat}><span className={s.statLabel}>MTTR</span><span className={s.statValue}>{data.mttr_seconds ? formatDuration(data.mttr_seconds) : '—'}</span></div>
              <div className={s.stat}><span className={s.statLabel}>Agent Accuracy</span><span className={s.statValue} style={{ color: confidenceColor(data.overall_agent_success_rate ?? 0) }}>{data.overall_agent_success_rate ?? 0}%</span></div>
              <div className={s.stat}><span className={s.statLabel}>Escalation Rate</span><span className={s.statValue}>{data.reasoning_escalation_rate ?? 0}%</span></div>
              <div className={s.stat}><span className={s.statLabel}>Investigations</span><span className={s.statValue}>{data.total_investigations}</span></div>
            </div>
          </BladeSection>

          <BladeSection label="Incident Trends">
            <ColumnChart data={trends} />
          </BladeSection>

          <BladeSection label="Root Cause Distribution">
            {distribution.length === 0 ? <span style={{ fontSize: 12, color: tokens.colorNeutralForeground4 }}>No data yet.</span> : <DistributionBar data={distribution} />}
          </BladeSection>
        </>
      )}
    </BladeModal>
  )
}

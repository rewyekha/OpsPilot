/**
 * AnalyticsPanel — executive analytics computed entirely from the persisted
 * investigation store (single source of truth). Every metric — MTTR, mean
 * duration, confidence distribution, root-cause categories, volume, agent
 * success rate, reasoning escalation rate — comes from real completed
 * investigations (GET /api/analytics). No static values; empty-state when none.
 */
import React, { useMemo } from 'react'
import { makeStyles, tokens, Spinner } from '@fluentui/react-components'
import { DataPieRegular } from '@fluentui/react-icons'
import { useAnalytics } from '../../hooks/useInsights'
import { confidenceColor, SEVERITY_COLORS, RISK_COLORS } from '../../theme/tokens'
import { formatDuration } from '../../utils/formatters'
import { EmptyState } from '../shared/EmptyState'
import { HBarChart, ColumnChart, DistributionBar, type BarDatum } from './charts'

const useStyles = makeStyles({
  page: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  head: { display: 'flex', flexDirection: 'column', gap: '4px' },
  h1: { fontSize: '22px', fontWeight: 700, color: tokens.colorNeutralForeground1, margin: 0, letterSpacing: '-0.3px' },
  sub: { fontSize: '13px', color: tokens.colorNeutralForeground3, margin: 0 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' },
  stat: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  statLabel: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
  statValue: { fontSize: '22px', fontWeight: 700, color: tokens.colorNeutralForeground1, letterSpacing: '-0.4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' },
  card: { backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px',
    transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
    ':hover': { transform: 'translateY(-2px)', border: `1px solid ${tokens.colorNeutralStroke2}`, boxShadow: '0 8px 22px rgba(0,0,0,0.3)' } },
  cardHead: { display: 'flex', flexDirection: 'column', gap: '2px' },
  cardTitle: { fontSize: '14px', fontWeight: 600, color: tokens.colorNeutralForeground1 },
  cardSub: { fontSize: '11px', color: tokens.colorNeutralForeground3 },
  center: { display: 'flex', justifyContent: 'center', padding: '40px' },
})

const Card: React.FC<{ title: string; subtitle: string; empty: boolean; children: React.ReactNode }> = ({ title, subtitle, empty, children }) => {
  const s = useStyles()
  return (
    <div className={s.card}>
      <div className={s.cardHead}><span className={s.cardTitle}>{title}</span><span className={s.cardSub}>{subtitle}</span></div>
      {empty ? <EmptyState title="No data yet" body="Populates as investigations complete." /> : children}
    </div>
  )
}

const DIST_COLORS = [SEVERITY_COLORS.critical.color, SEVERITY_COLORS.warning.color, SEVERITY_COLORS.info.color, RISK_COLORS.safe.color]

export const AnalyticsPanel: React.FC = () => {
  const s = useStyles()
  const { data, loading } = useAnalytics()

  const confidenceDist: BarDatum[] = useMemo(() => {
    const d = data?.confidence_distribution ?? {}
    const order = ['<50', '50–74', '75–89', '90+']
    return order.filter((k) => k in d).map((k, i) => ({ label: k, value: d[k], color: DIST_COLORS[i % DIST_COLORS.length] }))
  }, [data])

  const rootCauseDist: BarDatum[] = useMemo(() => {
    const d = data?.root_cause_categories ?? {}
    return Object.entries(d).map(([label, value], i) => ({ label, value, color: DIST_COLORS[i % DIST_COLORS.length] }))
  }, [data])

  const volume: BarDatum[] = useMemo(
    () => (data?.investigation_volume ?? []).map((v) => ({ label: v.label, value: v.count })),
    [data],
  )

  const agentSuccess: BarDatum[] = useMemo(() => {
    const d = data?.agent_success_rate ?? {}
    return Object.entries(d).map(([role, value]) => ({ label: role, value, color: confidenceColor(value), display: `${value}%` }))
  }, [data])

  if (loading) {
    return <div className={s.page}><div className={s.center}><Spinner label="Loading analytics…" /></div></div>
  }

  if (!data?.has_data) {
    return (
      <div className={s.page}>
        <div className={s.head}><h1 className={s.h1}>Analytics</h1><p className={s.sub}>Executive visibility across investigations.</p></div>
        <EmptyState
          icon={<DataPieRegular />}
          title="No analytics available yet"
          body={'Analytics are computed from real completed investigations.\nRun an investigation to populate MTTR, durations, confidence, and root-cause trends.'}
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      <div className={s.head}><h1 className={s.h1}>Analytics</h1><p className={s.sub}>Computed live from {data.total_investigations} completed investigation{data.total_investigations === 1 ? '' : 's'}.</p></div>

      <div className={s.statRow}>
        <div className={s.stat}><span className={s.statLabel}>Investigations</span><span className={s.statValue}>{data.total_investigations}</span></div>
        <div className={s.stat}><span className={s.statLabel}>MTTR</span><span className={s.statValue}>{data.mttr_seconds ? formatDuration(data.mttr_seconds) : '—'}</span></div>
        <div className={s.stat}><span className={s.statLabel}>Mean Duration</span><span className={s.statValue}>{data.mean_duration_seconds ? formatDuration(data.mean_duration_seconds) : '—'}</span></div>
        <div className={s.stat}><span className={s.statLabel}>Agent Success</span><span className={s.statValue} style={{ color: confidenceColor(data.overall_agent_success_rate ?? 0) }}>{data.overall_agent_success_rate ?? 0}%</span></div>
        <div className={s.stat}><span className={s.statLabel}>Escalation Rate</span><span className={s.statValue}>{data.reasoning_escalation_rate ?? 0}%</span></div>
      </div>

      <div className={s.grid}>
        <Card title="Investigation Volume" subtitle="Completed per day · last 7 days" empty={volume.every((v) => v.value === 0)}>
          <ColumnChart data={volume} />
        </Card>
        <Card title="Confidence Distribution" subtitle="Combined confidence buckets" empty={confidenceDist.length === 0}>
          <DistributionBar data={confidenceDist} />
        </Card>
        <Card title="Agent Success Rate" subtitle="Completed / total per agent" empty={agentSuccess.length === 0}>
          <HBarChart data={agentSuccess} />
        </Card>
        <Card title="Root Cause Categories" subtitle="Across all investigations" empty={rootCauseDist.length === 0}>
          <DistributionBar data={rootCauseDist} />
        </Card>
      </div>
    </div>
  )
}

/**
 * DemoScenariosPanel — judging control panel (DEMO ONLY).
 *
 * Executes / rolls back the infra/scripts/scenarios PowerShell scripts that
 * intentionally break the deployed workload so OpsPilot's autonomous monitor
 * detects + investigates the resulting telemetry anomaly. Backed entirely by the
 * real /api/demo endpoints — it never fabricates a scenario result.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { makeStyles, tokens, Button, Badge, Spinner } from '@fluentui/react-components'
import { PlayRegular, ArrowUndoRegular, BeakerRegular } from '@fluentui/react-icons'
import { demoApi, type DemoScenarioList, type DemoRunStatus } from '../../api/demo'
import { useNotify } from '../../store/NotificationContext'

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px 22px', maxWidth: '1100px' },
  head: { display: 'flex', flexDirection: 'column', gap: '4px' },
  title: { fontSize: '20px', fontWeight: 700, color: tokens.colorNeutralForeground1, display: 'flex', alignItems: 'center', gap: '8px' },
  sub: { fontSize: '13px', color: tokens.colorNeutralForeground3 },
  banner: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px', borderRadius: '8px', fontSize: '12px',
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`, backgroundColor: tokens.colorPaletteYellowBackground1, color: tokens.colorNeutralForeground1 },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: '11px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '12px' },
  card: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 16px', borderRadius: '8px',
    border: `1px solid ${tokens.colorNeutralStroke1}`, backgroundColor: tokens.colorNeutralBackground2 },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  name: { fontSize: '14px', fontWeight: 700, color: tokens.colorNeutralForeground1 },
  desc: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  status: { fontSize: '11px', color: tokens.colorNeutralForeground2, display: 'flex', alignItems: 'center', gap: '6px', minHeight: '18px' },
  actions: { display: 'flex', gap: '8px', marginTop: '2px' },
  out: { fontFamily: 'ui-monospace, monospace', fontSize: '10.5px', whiteSpace: 'pre-wrap', maxHeight: '120px', overflow: 'auto',
    backgroundColor: tokens.colorNeutralBackground3, borderRadius: '6px', padding: '8px', color: tokens.colorNeutralForeground2, margin: 0 },
  note: { fontSize: '12px', color: tokens.colorNeutralForeground3, marginTop: '4px' },
})

function stateColor(st?: DemoRunStatus): string {
  if (!st || st.state === 'idle') return '#64748b'
  if (st.state === 'running') return '#f59e0b'
  return st.returncode === 0 ? '#22c55e' : '#dc2626'
}

export const DemoScenariosPanel: React.FC = () => {
  const s = useStyles()
  const notify = useNotify()
  const [list, setList] = useState<DemoScenarioList | null>(null)
  const [statuses, setStatuses] = useState<Record<string, DemoRunStatus>>({})

  const reload = useCallback(() => { demoApi.list().then(setList).catch(() => {}) }, [])
  useEffect(() => {
    reload()
    window.addEventListener('opspilot:poll', reload)
    return () => window.removeEventListener('opspilot:poll', reload)
  }, [reload])

  const ids = (list?.scenarios ?? []).map((x) => x.id).join(',')
  useEffect(() => {
    if (!ids) return
    const poll = () => ids.split(',').forEach((id) =>
      demoApi.status(id).then((st) => setStatuses((p) => ({ ...p, [id]: st }))).catch(() => {}))
    poll()
    window.addEventListener('opspilot:poll', poll)
    return () => window.removeEventListener('opspilot:poll', poll)
  }, [ids])

  const run = (id: string, name: string) =>
    demoApi.run(id)
      .then(() => notify({ title: `Scenario started: ${name}`, body: 'Breaking the workload — watch the Dashboard for the auto-detected incident.', intent: 'success' }))
      .catch((e: unknown) => notify({ title: 'Could not start scenario', body: e instanceof Error ? e.message : 'Request failed', intent: 'error' }))

  const rollback = (id: string, name: string) =>
    demoApi.rollback(id)
      .then(() => notify({ title: `Rolling back: ${name}`, body: 'Restoring the workload to a healthy state.', intent: 'info' }))
      .catch((e: unknown) => notify({ title: 'Could not roll back', body: e instanceof Error ? e.message : 'Request failed', intent: 'error' }))

  const enabled = !!list?.demo_mode_enabled && !!list?.pwsh_available

  return (
    <div className={s.page}>
      <div className={s.head}>
        <span className={s.title}><BeakerRegular /> Demo Scenarios</span>
        <span className={s.sub}>
          Intentionally break the deployed workload so OpsPilot autonomously detects, creates an incident,
          and investigates — end to end. {list ? `Target: ${list.app_name} in ${list.resource_group}.` : ''}
        </span>
      </div>

      {list && !list.demo_mode_enabled && (
        <div className={s.banner}>
          <strong>Demo mode is disabled.</strong>
          <span>Execution is blocked. Enable it on the backend, then restart:</span>
          <span className={s.mono}>DEMO_MODE_ENABLED=true · DEMO_RESOURCE_GROUP=&lt;rg&gt; · DEMO_APP_NAME=&lt;app&gt;</span>
          <span>You can also run any scenario manually from <span className={s.mono}>infra/scripts/scenarios/</span>.</span>
        </div>
      )}
      {list && list.demo_mode_enabled && !list.pwsh_available && (
        <div className={s.banner}><strong>PowerShell (pwsh) not found on the backend host.</strong>
          <span>Scenarios can only be executed where pwsh + the Azure CLI are installed.</span></div>
      )}

      <div className={s.grid}>
        {(list?.scenarios ?? []).map((sc) => {
          const st = statuses[sc.id]
          const running = st?.state === 'running' || sc.running
          return (
            <div key={sc.id} className={s.card}>
              <div className={s.cardHead}>
                <span className={s.name}>{sc.name}</span>
                <Badge appearance="tint" color="informative">{sc.expected}</Badge>
              </div>
              <span className={s.desc}>{sc.description}</span>
              <span className={s.status}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: stateColor(st), display: 'inline-block' }} />
                {running ? <><Spinner size="extra-tiny" /> {st?.action ?? 'running'}…{st?.elapsed_seconds ? ` ${Math.round(st.elapsed_seconds)}s` : ''}</>
                  : st && st.state === 'finished' ? `${st.action} ${st.returncode === 0 ? 'succeeded' : `exited ${st.returncode}`}`
                  : 'idle'}
              </span>
              <div className={s.actions}>
                <Button size="small" appearance="primary" icon={<PlayRegular />} disabled={!enabled || running} onClick={() => run(sc.id, sc.name)}>Execute</Button>
                <Button size="small" icon={<ArrowUndoRegular />} disabled={!enabled || running} onClick={() => rollback(sc.id, sc.name)}>Rollback</Button>
              </div>
              {st?.output_tail ? <pre className={s.out}>{st.output_tail}</pre> : null}
            </div>
          )
        })}
      </div>

      <span className={s.note}>
        After executing, open the <strong>Dashboard</strong>. Allow ~2–5 minutes for Azure telemetry ingestion;
        the autonomous monitor then auto-creates the incident and dispatches the agent investigation. Always
        <strong> Rollback</strong> when finished to restore the workload.
      </span>
    </div>
  )
}

/**
 * DemoScenariosPanel — judging control panel (DEMO ONLY).
 *
 * Executes / rolls back the infra/scripts/scenarios PowerShell scripts that
 * intentionally break the deployed workload so OpsPilot's autonomous monitor
 * detects + investigates the resulting telemetry anomaly. Backed entirely by the
 * real /api/demo endpoints — it never fabricates a scenario result.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { makeStyles, tokens, Button, Spinner, Dropdown, Option } from '@fluentui/react-components'
import { PlayRegular, ArrowUndoRegular, BeakerRegular } from '@fluentui/react-icons'
import { demoApi, type DemoScenarioList, type DemoRunStatus } from '../../api/demo'
import { useMonitoredServices } from '../../hooks/useMonitoredServices'
import { useNotify } from '../../store/NotificationContext'

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px 22px' },
  head: { display: 'flex', flexDirection: 'column', gap: '4px' },
  title: { fontSize: '20px', fontWeight: 700, color: tokens.colorNeutralForeground1, display: 'flex', alignItems: 'center', gap: '8px' },
  sub: { fontSize: '13px', color: tokens.colorNeutralForeground3 },
  banner: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px', borderRadius: '8px', fontSize: '12px',
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`, backgroundColor: tokens.colorPaletteYellowBackground1, color: tokens.colorNeutralForeground1 },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: '11px' },
  targetRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' },
  targetLabel: { fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground2 },
  targetDropdown: { minWidth: '190px' },
  targetHint: { fontSize: '11px', color: tokens.colorNeutralForeground4 },
  // All 5 scenarios on ONE row, EQUAL height (stretch), with a little space above.
  // minmax(0,1fr) lets the columns shrink to fit the viewport; narrow screens scroll.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))', gap: '12px',
    overflowX: 'auto', alignItems: 'stretch', marginTop: '18px', paddingBottom: '4px' },
  card: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 16px', borderRadius: '8px',
    minWidth: 0, height: '100%', boxSizing: 'border-box',
    border: `1px solid ${tokens.colorNeutralStroke1}`, backgroundColor: tokens.colorNeutralBackground2,
    // Clean, flat hover — no lift/movement, just a subtle border + background highlight.
    transition: 'background-color 140ms ease, border-color 140ms ease',
    ':hover': { border: `1px solid ${tokens.colorBrandStroke1}`, backgroundColor: tokens.colorNeutralBackground2Hover } },
  // align badge to the top so a 2-line title (e.g. "Deployment Regression") looks right
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' },
  name: { fontSize: '14px', fontWeight: 700, color: tokens.colorNeutralForeground1, flex: 1, minWidth: 0 },
  // Wrapping chip (replaces Fluent Badge, whose pill clipped long labels like the
  // deployment one). whiteSpace:normal wraps inside the rounded shape; capped width.
  tag: { flexShrink: 0, maxWidth: '48%', fontSize: '10px', fontWeight: 600, lineHeight: 1.25,
    padding: '3px 8px', borderRadius: '8px', whiteSpace: 'normal', textAlign: 'center',
    backgroundColor: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.28)' },
  desc: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  // marginTop:auto pushes the status + buttons to the BOTTOM so footers align across cards
  status: { fontSize: '11px', color: tokens.colorNeutralForeground2, display: 'flex', alignItems: 'center', gap: '6px', minHeight: '18px', marginTop: 'auto' },
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
  const { data: servicesData } = useMonitoredServices()
  const [list, setList] = useState<DemoScenarioList | null>(null)
  const [statuses, setStatuses] = useState<Record<string, DemoRunStatus>>({})
  const [selectedApp, setSelectedApp] = useState<string>('')

  const reload = useCallback(() => { demoApi.list().then(setList).catch(() => {}) }, [])
  useEffect(() => {
    reload()
    window.addEventListener('opspilot:poll', reload)
    return () => window.removeEventListener('opspilot:poll', reload)
  }, [reload])

  // Default the target app to the configured demo app once the list loads.
  useEffect(() => { if (list?.app_name && !selectedApp) setSelectedApp(list.app_name) }, [list, selectedApp])

  // Targetable apps = configured demo app ∪ every discovered Azure service.
  const apps = useMemo(() => {
    const set = new Set<string>()
    if (list?.app_name) set.add(list.app_name)
    ;(servicesData?.services ?? []).forEach((sv) => set.add(sv.name))
    return Array.from(set)
  }, [list, servicesData])

  const ids = (list?.scenarios ?? []).map((x) => x.id).join(',')
  useEffect(() => {
    if (!ids || !selectedApp) return
    const poll = () => ids.split(',').forEach((id) =>
      demoApi.status(id, selectedApp).then((st) => setStatuses((p) => ({ ...p, [id]: st }))).catch(() => {}))
    poll()
    window.addEventListener('opspilot:poll', poll)
    return () => window.removeEventListener('opspilot:poll', poll)
  }, [ids, selectedApp])

  const run = (id: string, name: string) =>
    demoApi.run(id, selectedApp)
      .then(() => notify({ title: `Scenario started: ${name} on ${selectedApp}`, body: 'Breaking the workload — watch the Dashboard for the auto-detected incident.', intent: 'success' }))
      .catch((e: unknown) => notify({ title: 'Could not start scenario', body: e instanceof Error ? e.message : 'Request failed', intent: 'error' }))

  const rollback = (id: string, name: string) =>
    demoApi.rollback(id, selectedApp)
      .then(() => notify({ title: `Rolling back: ${name} on ${selectedApp}`, body: 'Restoring the workload to a healthy state.', intent: 'info' }))
      .catch((e: unknown) => notify({ title: 'Could not roll back', body: e instanceof Error ? e.message : 'Request failed', intent: 'error' }))

  const enabled = !!list?.demo_mode_enabled && !!list?.pwsh_available

  return (
    <div className={s.page}>
      <div className={s.head}>
        <span className={s.title}><BeakerRegular /> Demo Scenarios</span>
        <span className={s.sub}>
          Intentionally break the deployed workload so OpsPilot autonomously detects, creates an incident,
          and investigates — end to end. {list ? `Resource group: ${list.resource_group}.` : ''}
        </span>
        <div className={s.targetRow}>
          <span className={s.targetLabel}>Target app</span>
          <Dropdown
            size="small"
            className={s.targetDropdown}
            value={selectedApp || (list?.app_name ?? '')}
            selectedOptions={selectedApp ? [selectedApp] : []}
            disabled={!enabled || apps.length === 0}
            onOptionSelect={(_, d) => { if (d.optionValue) { setSelectedApp(d.optionValue); setStatuses({}) } }}
          >
            {apps.map((a) => <Option key={a} value={a}>{a}</Option>)}
          </Dropdown>
          <span className={s.targetHint}>The Execute / Rollback buttons act on this app.</span>
        </div>
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
                <span className={s.tag}>{sc.expected}</span>
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

/**
 * LoginPage — animated sign-in gate for OpsPilot.
 *
 * Aesthetic: GitHub/Copilot-style — drifting aurora blobs, a live particle-network
 * canvas (the "telemetry mesh"), a glassmorphic card that fades up, a pulsing
 * hex logo, and a shimmering sign-in button. Pure CSS keyframes + one rAF canvas.
 */
import React, { useEffect, useRef, useState } from 'react'
import { makeStyles, tokens, Spinner } from '@fluentui/react-components'
import { PersonRegular, LockClosedRegular, ArrowRightRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  root: {
    position: 'fixed', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse at 50% 28%, #102a52 0%, #0a1628 58%, #060d1c 100%)',
    fontFamily: tokens.fontFamilyBase,
  },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'linear-gradient(rgba(96,165,250,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.06) 1px, transparent 1px)',
    backgroundSize: '46px 46px',
    maskImage: 'radial-gradient(ellipse at center, black 25%, transparent 72%)',
    WebkitMaskImage: 'radial-gradient(ellipse at center, black 25%, transparent 72%)',
  },
  blob: { position: 'absolute', borderRadius: '50%', filter: 'blur(72px)', opacity: 0.55, pointerEvents: 'none' },
  blob1: {
    width: '460px', height: '460px', top: '-130px', left: '-90px',
    background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)',
    animationName: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(120px,80px) scale(1.2)' } },
    animationDuration: '20s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out',
  },
  blob2: {
    width: '540px', height: '540px', bottom: '-170px', right: '-110px',
    background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
    animationName: { '0%,100%': { transform: 'translate(0,0) scale(1.1)' }, '50%': { transform: 'translate(-110px,-70px) scale(1)' } },
    animationDuration: '24s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out',
  },
  blob3: {
    width: '380px', height: '380px', top: '42%', left: '56%',
    background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
    animationName: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(-80px,60px) scale(1.25)' } },
    animationDuration: '28s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out',
  },

  statusBadge: {
    position: 'absolute', top: '24px', display: 'flex', alignItems: 'center', gap: '7px',
    fontSize: '11px', fontWeight: 600, letterSpacing: '0.3px', color: 'rgba(255,255,255,0.55)', zIndex: 2,
  },
  liveDot: {
    width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e',
    animationName: { '0%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.6)' }, '70%': { boxShadow: '0 0 0 6px rgba(34,197,94,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' } },
    animationDuration: '2s', animationIterationCount: 'infinite',
  },

  card: {
    position: 'relative', zIndex: 2, width: '380px', maxWidth: '92vw', padding: '34px 32px 26px',
    borderRadius: '18px', border: '1px solid rgba(255,255,255,0.09)',
    background: 'rgba(13,25,44,0.62)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
    boxShadow: '0 26px 72px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    animationName: { '0%': { opacity: 0, transform: 'translateY(26px) scale(0.985)' }, '100%': { opacity: 1, transform: 'translateY(0) scale(1)' } },
    animationDuration: '0.7s', animationTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
  },
  logoWrap: { position: 'relative', width: '58px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' },
  hex: {
    width: '54px', height: '54px', display: 'block',
    filter: 'drop-shadow(0 4px 14px rgba(59,130,246,0.45))',
    animationName: { '0%,100%': { filter: 'drop-shadow(0 4px 14px rgba(59,130,246,0.4)) brightness(1)' }, '50%': { filter: 'drop-shadow(0 4px 18px rgba(59,130,246,0.65)) brightness(1.12)' } },
    animationDuration: '3s', animationIterationCount: 'infinite',
  },
  ring: {
    position: 'absolute', inset: '-7px', borderRadius: '50%', border: '1.5px solid rgba(59,130,246,0.4)',
    animationName: { '0%': { transform: 'scale(0.85)', opacity: 0.7 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
    animationDuration: '2.8s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-out',
  },
  title: { fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', color: '#fff', margin: 0 },
  tagline: { fontSize: '12.5px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 22px', letterSpacing: '0.2px' },

  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' },
  field: { position: 'relative', display: 'flex', alignItems: 'center' },
  fieldIcon: { position: 'absolute', left: '13px', display: 'flex', color: 'rgba(255,255,255,0.4)', fontSize: '16px', pointerEvents: 'none' },
  input: {
    width: '100%', height: '44px', padding: '0 14px 0 38px', fontSize: '14px', color: '#fff', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', outline: 'none',
    transition: 'border-color 160ms ease, box-shadow 160ms ease, background 160ms ease',
    '::placeholder': { color: 'rgba(255,255,255,0.34)' },
    ':focus': { border: '1px solid rgba(59,130,246,0.75)', background: 'rgba(59,130,246,0.06)', boxShadow: '0 0 0 3px rgba(59,130,246,0.15)' },
  },
  signin: {
    position: 'relative', overflow: 'hidden', height: '44px', marginTop: '6px', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer',
    background: 'linear-gradient(120deg, #1d4ed8, #3b82f6, #06b6d4, #3b82f6, #1d4ed8)', backgroundSize: '220% 100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    boxShadow: '0 8px 24px rgba(37,99,235,0.42)',
    animationName: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '220% 50%' } },
    animationDuration: '4.5s', animationIterationCount: 'infinite', animationTimingFunction: 'linear',
    transition: 'transform 140ms ease, box-shadow 140ms ease',
    ':hover': { transform: 'translateY(-1px)', boxShadow: '0 12px 32px rgba(37,99,235,0.58)' },
    ':active': { transform: 'translateY(0)' },
    ':disabled': { cursor: 'default', opacity: 0.9, transform: 'none' },
  },
  divider: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', margin: '16px 0 12px', color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 600 },
  line: { flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' },
  sso: {
    height: '42px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
    color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    transition: 'background 140ms ease, border-color 140ms ease, transform 140ms ease',
    ':hover': { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.22)' },
    ':active': { transform: 'scale(0.99)' },
  },
  msLogo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', width: '16px', height: '16px' },
  footer: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '20px', textAlign: 'center', lineHeight: 1.5 },
})

const ParticleMesh: React.FC<{ className: string }> = ({ className }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let w = 0, h = 0, raf = 0
    type P = { x: number; y: number; vx: number; vy: number }
    let pts: P[] = []
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      w = canvas.offsetWidth; h = canvas.offsetHeight
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.max(28, Math.min(80, Math.floor((w * h) / 20000)))
      pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4 }))
    }
    resize()
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.hypot(dx, dy)
          if (d < 132) {
            ctx.strokeStyle = `rgba(96,165,250,${0.13 * (1 - d / 132)})`
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke()
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = 'rgba(120,180,255,0.75)'
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className={className} />
}

export const LoginPage: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => {
  const s = useStyles()
  const [loading, setLoading] = useState(false)

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (loading) return
    setLoading(true)
    window.setTimeout(onSignIn, 950) // brief "authenticating" for polish
  }

  return (
    <div className={s.root}>
      <div className={s.grid} />
      <span className={`${s.blob} ${s.blob1}`} />
      <span className={`${s.blob} ${s.blob2}`} />
      <span className={`${s.blob} ${s.blob3}`} />
      <ParticleMesh className={s.canvas} />

      <div className={s.statusBadge}>
        <span className={s.liveDot} /> Autonomous incident intelligence
      </div>

      <form className={s.card} onSubmit={submit}>
        <div className={s.logoWrap}>
          <span className={s.ring} />
          <img className={s.hex} src="/favicon.svg" alt="OpsPilot" draggable={false} />
        </div>
        <h1 className={s.title}>OpsPilot</h1>
        <p className={s.tagline}>Sign in to your autonomous SRE</p>

        <div className={s.form}>
          <label className={s.field}>
            <span className={s.fieldIcon}><PersonRegular /></span>
            <input className={s.input} type="email" placeholder="work email" defaultValue="sysadmin@opspilot.io" autoComplete="username" />
          </label>
          <label className={s.field}>
            <span className={s.fieldIcon}><LockClosedRegular /></span>
            <input className={s.input} type="password" placeholder="password" autoComplete="current-password" />
          </label>

          <button className={s.signin} type="submit" disabled={loading}>
            {loading ? <><Spinner size="tiny" appearance="inverted" /> Authenticating…</> : <>Sign in <ArrowRightRegular /></>}
          </button>
        </div>

        <div className={s.divider}><span className={s.line} /> OR <span className={s.line} /></div>

        <button type="button" className={s.sso} onClick={() => submit()} disabled={loading}>
          <span className={s.msLogo}>
            <span style={{ background: '#f25022' }} /><span style={{ background: '#7fba00' }} />
            <span style={{ background: '#00a4ef' }} /><span style={{ background: '#ffb900' }} />
          </span>
          Continue with Microsoft
        </button>

        <p className={s.footer}>Powered by Azure AI Foundry · 7-agent investigation engine</p>
      </form>
    </div>
  )
}

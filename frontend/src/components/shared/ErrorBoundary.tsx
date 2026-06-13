/**
 * ErrorBoundary — prevents a single component crash from blanking the app.
 *
 * Placed around the page content inside AppShell, so a render error shows a
 * recoverable fallback panel while the navigation shell (top bar, command bar,
 * side nav) stays intact. "Try again" resets the boundary; changing the page
 * (via the `resetKey` prop) also clears the error so navigation recovers.
 */
import React from 'react'
import { makeStyles, tokens, Button } from '@fluentui/react-components'
import { ErrorCircleRegular, ArrowClockwiseRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  panel: {
    margin: '24px',
    padding: '24px',
    borderRadius: '8px',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '640px',
  },
  head: { display: 'flex', alignItems: 'center', gap: '10px' },
  icon: { fontSize: '22px', color: tokens.colorPaletteRedForeground1 },
  title: { fontSize: '16px', fontWeight: 700, color: tokens.colorNeutralForeground1, margin: 0 },
  msg: { fontSize: '13px', color: tokens.colorNeutralForeground2, margin: 0, lineHeight: 1.5 },
  detail: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
  },
  actions: { display: 'flex', gap: '8px' },
})

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** When this value changes, a previously-caught error is cleared. */
  resetKey?: unknown
}

interface ErrorBoundaryState {
  error: Error | null
}

const Fallback: React.FC<{ error: Error; onRetry: () => void }> = ({ error, onRetry }) => {
  const s = useStyles()
  return (
    <div className={s.panel} role="alert">
      <div className={s.head}>
        <ErrorCircleRegular className={s.icon} />
        <h2 className={s.title}>This view hit an unexpected error</h2>
      </div>
      <p className={s.msg}>
        The rest of OpsPilot is still available — use the navigation to continue, or retry this view.
      </p>
      <pre className={s.detail}>{error.message || 'Unknown error'}</pre>
      <div className={s.actions}>
        <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface to the console for debugging; never blanks the app.
    console.error('[OpsPilot] ErrorBoundary caught an error:', error, info.componentStack)
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    // Reset on navigation so moving to another page recovers automatically.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private handleRetry = () => this.setState({ error: null })

  render(): React.ReactNode {
    if (this.state.error) {
      return <Fallback error={this.state.error} onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

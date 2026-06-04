import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FluentProvider } from '@fluentui/react-components'
import { opsPilotDarkTheme } from '../../theme/darkTheme'
import { ErrorBoundary } from './ErrorBoundary'

const Boom = () => {
  throw new Error('kaboom')
}

const wrap = (ui: React.ReactNode) =>
  render(<FluentProvider theme={opsPilotDarkTheme}>{ui}</FluentProvider>)

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    wrap(
      <ErrorBoundary>
        <div>healthy content</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('healthy content')).toBeTruthy()
  })

  it('renders a fallback panel instead of crashing when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    wrap(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    // No blank screen: an alert fallback is shown.
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/unexpected error/i)).toBeTruthy()
    spy.mockRestore()
  })
})

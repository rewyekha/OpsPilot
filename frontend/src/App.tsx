import { useEffect, useState } from 'react'
import { FluentProvider } from '@fluentui/react-components'
import { opsPilotDarkTheme } from './theme/darkTheme'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './components/auth/LoginPage'
import { PreferencesProvider } from './store/PreferencesContext'
import { FilterProvider } from './store/FilterContext'
import { NotificationProvider } from './store/NotificationContext'
import { SessionProvider } from './store/SessionContext'

export default function App() {
  // Animated login gate. sessionStorage so it persists during a session but shows
  // again on a fresh launch (a nice opener for the demo video).
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('opspilot:authed') === '1')

  // Sign out (avatar menu → "Sign out" dispatches `opspilot:signout`). Clears the
  // auth session and drops back to the LoginPage. Because the whole app is gated on
  // `authed`, flipping it false here is the auth guard: a browser refresh re-reads
  // the now-empty sessionStorage → Login, and there is no route to "go back" to the
  // dashboard. Only auth keys are removed — user preferences in localStorage stay.
  useEffect(() => {
    const onSignOut = () => {
      sessionStorage.removeItem('opspilot:authed')
      localStorage.removeItem('opspilot:authed')
      setAuthed(false)
    }
    window.addEventListener('opspilot:signout', onSignOut)
    return () => window.removeEventListener('opspilot:signout', onSignOut)
  }, [])

  return (
    <FluentProvider
      theme={opsPilotDarkTheme}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {authed ? (
        <PreferencesProvider>
          <FilterProvider>
            <NotificationProvider>
              <SessionProvider>
                <AppShell />
              </SessionProvider>
            </NotificationProvider>
          </FilterProvider>
        </PreferencesProvider>
      ) : (
        <LoginPage onSignIn={() => { sessionStorage.setItem('opspilot:authed', '1'); setAuthed(true) }} />
      )}
    </FluentProvider>
  )
}

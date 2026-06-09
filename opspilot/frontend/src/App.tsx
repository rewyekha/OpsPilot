import { useState } from 'react'
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

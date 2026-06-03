import { FluentProvider } from '@fluentui/react-components'
import { opsPilotDarkTheme } from './theme/darkTheme'
import { AppShell } from './components/layout/AppShell'
import { PreferencesProvider } from './store/PreferencesContext'
import { FilterProvider } from './store/FilterContext'
import { NotificationProvider } from './store/NotificationContext'
import { SessionProvider } from './store/SessionContext'

export default function App() {
  return (
    <FluentProvider
      theme={opsPilotDarkTheme}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <PreferencesProvider>
        <FilterProvider>
          <NotificationProvider>
            <SessionProvider>
              <AppShell />
            </SessionProvider>
          </NotificationProvider>
        </FilterProvider>
      </PreferencesProvider>
    </FluentProvider>
  )
}

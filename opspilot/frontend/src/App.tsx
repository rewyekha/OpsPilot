import { FluentProvider } from '@fluentui/react-components'
import { opsPilotDarkTheme } from './theme/darkTheme'
import { AppShell } from './components/layout/AppShell'

export default function App() {
  return (
    <FluentProvider theme={opsPilotDarkTheme} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppShell />
    </FluentProvider>
  )
}

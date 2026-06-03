import { ScrollView } from 'react-native'
import AuthDebugPanel from '../_components/auth-debug-panel'

export default function AuthDebugScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <AuthDebugPanel />
    </ScrollView>
  )
}

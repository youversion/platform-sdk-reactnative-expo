import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import MissingAppKey from './_components/missing-app-key'

// Must match exactly an allowed redirect URI registered in the YouVersion
// Platform console. Hardcoded (not Linking.createURL) so the value is stable
// across dev and prod builds. App scheme is set in app.json ("yvp-rn-example").
const redirectUri = 'yvp-rn-example://callback'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {appKey ? (
        <YouVersionProvider
          appKey={appKey}
          theme="system"
          auth={{ redirectUri, scopes: ['profile', 'email'] }}
        >
          <Stack screenOptions={{ headerShown: false }} />
        </YouVersionProvider>
      ) : (
        <MissingAppKey />
      )}
    </GestureHandlerRootView>
  )
}

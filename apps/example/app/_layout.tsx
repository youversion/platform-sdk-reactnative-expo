import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import * as Linking from 'expo-linking'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import MissingAppKey from './_components/missing-app-key'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY
  // Scheme named explicitly: `app.json` also registers `youversionauth` for the
  // data-exchange return, and createURL would otherwise just take the first
  // array entry — leaving the OAuth redirect at the mercy of that ordering.
  const redirectUri = Linking.createURL('callback', { scheme: 'yvp-rn-example' })

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

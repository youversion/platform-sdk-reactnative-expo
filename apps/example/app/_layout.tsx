import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import * as Linking from 'expo-linking'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import MissingAppKey from './_components/missing-app-key'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY
  const redirectUri = Linking.createURL('callback')

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {appKey ? (
        <YouVersionProvider
          appKey={appKey}
          theme="system"
          // `highlights` is a permission, not a scope — it rides in
          // `requested_permissions[]`. Without it the token cannot read or write
          // highlights, so the reader paints nothing no matter what the user has.
          auth={{ redirectUri, scopes: ['profile', 'email'], permissions: ['highlights'] }}
        >
          <Stack screenOptions={{ headerShown: false }} />
        </YouVersionProvider>
      ) : (
        <MissingAppKey />
      )}
    </GestureHandlerRootView>
  )
}

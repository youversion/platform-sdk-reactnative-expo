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

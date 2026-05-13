import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import MissingAppKey from './_components/missing-app-key'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {appKey ? (
        <YouVersionProvider appKey={appKey}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </YouVersionProvider>
      ) : (
        <MissingAppKey />
      )}
    </GestureHandlerRootView>
  )
}

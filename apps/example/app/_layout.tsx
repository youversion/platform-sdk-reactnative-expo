import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import MissingAppKey from './_components/missing-app-key'

/**
 * An app key has exactly one registered callback URL, and both flows that come
 * back through the browser — sign-in and the data-exchange permission grant —
 * use it. Register this exact value in the YouVersion Platform console, and
 * register the `youversionauth` scheme in `app.json` so Android can route it.
 */
const REDIRECT_URI = 'youversionauth://callback'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {appKey ? (
        <YouVersionProvider
          appKey={appKey}
          theme="system"
          auth={{
            redirectUri: REDIRECT_URI,
            scopes: ['profile', 'email'],
            permissions: ['highlights'],
          }}
          // Optional version filter (forwarded to the web SDK once published):
          // permittedVersionIds={[111, 206]}
          // excludedVersionIds={[3034]}
          // permittedLanguageTags={['en', 'zh-Hans']}
          // Optional locale override (resolved lng is forwarded into each DOM web provider):
          // locale="es"
        >
          <Stack screenOptions={{ headerShown: false }} />
        </YouVersionProvider>
      ) : (
        <MissingAppKey />
      )}
    </GestureHandlerRootView>
  )
}

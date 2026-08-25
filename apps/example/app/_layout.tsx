import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import { Stack } from 'expo-router'
import { useLayoutEffect } from 'react'
import { Platform } from 'react-native'
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
  // Metro web: html/body 100% computes to 0, so NativeTabs clip BibleCard.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const root = document.getElementById('root')
    if (!root) return
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'
    root.style.minHeight = '100vh'
    root.style.height = '100vh'
  }, [])

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
          // Optional version filter (enforced in each Expo DOM WebView):
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

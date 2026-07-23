import { useYouVersion, useYVAuth } from '@youversion/platform-react-native-expo-core'
import { YouVersionAuthButton } from '@youversion/platform-react-native-expo-ui'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'

// Relative import keeps createHighlightsApi off the package barrel until Subtask 3.
import { createHighlightsApi } from '../../../../packages/core/src/highlights'

/** Known free ESV id — matches platform-core highlights fixtures. */
const TEST_VERSION_ID = 111
const TEST_CHAPTER = 'JHN.3'
const TEST_VERSE = 'JHN.3.16'
const TEST_COLOR = 'fffe00'

export default function ProfileScreen() {
  const { isAuthenticated, isLoading, userInfo, accessToken } = useYVAuth()
  const { appKey, apiHost, installationId } = useYouVersion()
  const isDark = useColorScheme() === 'dark'
  const c = isDark ? dark : light

  const highlightsApi = useMemo(
    () =>
      createHighlightsApi({
        appKey,
        apiHost,
        installationId,
        additionalHeaders: { 'x-yvp-sdk': 'ReactNativeSDK=example-dev' },
      }),
    [appKey, apiHost, installationId],
  )

  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string>('')

  async function run(
    label: string,
    action: (token: string) => Promise<unknown>,
  ): Promise<void> {
    if (!accessToken) {
      setLog('No access token — sign in first (must request the highlights permission).')
      return
    }
    const token = accessToken
    setBusy(true)
    setLog(`${label}…`)
    try {
      const result = await action(token)
      setLog(`${label}\n${JSON.stringify(result, null, 2)}`)
    } catch (error) {
      setLog(
        `${label} threw (should not happen — wrapper returns Result):\n${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      style={{ backgroundColor: c.bg }}
    >
      {isLoading ? (
        <Text style={[styles.muted, { color: c.muted }]}>Loading…</Text>
      ) : isAuthenticated ? (
        <View style={styles.signedIn}>
          {userInfo?.avatarUrl ? (
            <Image source={{ uri: userInfo.avatarUrl }} style={styles.avatar} />
          ) : null}
          <Text style={[styles.muted, { color: c.muted }]}>You are signed in as</Text>
          <Text style={[styles.name, { color: c.fg }]}>{userInfo?.name ?? '(no name)'}</Text>
          <Text style={[styles.email, { color: c.email }]}>{userInfo?.email ?? '(no email)'}</Text>
          <View style={styles.button}>
            <YouVersionAuthButton mode="signOut" background={isDark ? 'dark' : 'light'} outline />
          </View>

          <View style={[styles.devBox, { borderColor: c.border }]}>
            <Text style={[styles.devTitle, { color: c.fg }]}>Highlights API (dev)</Text>
            <Text style={[styles.devHint, { color: c.muted }]}>
              Sign out and back in if this session predates requesting the highlights permission.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                run('getHighlights', (token) =>
                  highlightsApi.getHighlights(token, {
                    version_id: TEST_VERSION_ID,
                    passage_id: TEST_CHAPTER,
                  }),
                )
              }
              style={[styles.devButton, { backgroundColor: c.btn }]}
            >
              <Text style={[styles.devButtonText, { color: c.btnText }]}>
                Fetch {TEST_CHAPTER} highlights
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                run('createHighlight', (token) =>
                  highlightsApi.createHighlight(token, {
                    version_id: TEST_VERSION_ID,
                    passage_id: TEST_VERSE,
                    color: TEST_COLOR,
                  }),
                )
              }
              style={[styles.devButton, { backgroundColor: c.btn }]}
            >
              <Text style={[styles.devButtonText, { color: c.btnText }]}>
                Create {TEST_VERSE} highlight
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                run('deleteHighlight', (token) =>
                  highlightsApi.deleteHighlight(token, TEST_VERSE, {
                    version_id: TEST_VERSION_ID,
                  }),
                )
              }
              style={[styles.devButton, { backgroundColor: c.btn }]}
            >
              <Text style={[styles.devButtonText, { color: c.btnText }]}>
                Delete {TEST_VERSE} highlight
              </Text>
            </Pressable>
            {busy ? <ActivityIndicator color={c.fg} style={styles.spinner} /> : null}
            {log ? (
              <Text selectable style={[styles.log, { color: c.muted, backgroundColor: c.logBg }]}>
                {log}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.signedOut}>
          <YouVersionAuthButton mode="signIn" background={isDark ? 'dark' : 'light'} outline />
          <Text style={[styles.devHint, { color: c.muted, marginTop: 16 }]}>
            Sign in requests the highlights permission so the Profile test buttons can call the API.
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const light = {
  bg: '#ffffff',
  fg: '#000000',
  muted: '#6b6b6b',
  email: '#3c3c3c',
  border: '#d0d0d0',
  btn: '#1a1a1a',
  btnText: '#ffffff',
  logBg: '#f4f4f4',
}
const dark = {
  bg: '#000000',
  fg: '#ffffff',
  muted: '#9b9b9b',
  email: '#c8c8c8',
  border: '#3a3a3a',
  btn: '#e8e8e8',
  btnText: '#111111',
  logBg: '#1c1c1c',
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  signedIn: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  signedOut: {
    alignItems: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 8,
  },
  muted: {
    fontSize: 15,
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
  },
  email: {
    fontSize: 15,
  },
  button: {
    marginTop: 16,
  },
  devBox: {
    marginTop: 28,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  devTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  devHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  devButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  devButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  spinner: {
    marginTop: 4,
  },
  log: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Courier',
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
})

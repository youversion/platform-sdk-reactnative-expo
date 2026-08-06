import { useYVAuthOptional } from '@youversion/platform-react-native-expo-core'
import { YouVersionAuthButton } from '@youversion/platform-react-native-expo-ui'
import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'

export default function ProfileScreen() {
  // `useYVAuthOptional()` returns null when the provider has no `auth` config,
  // where `useYVAuth()` would throw. Use the optional form on any screen that can
  // render in an app build without sign-in — including this one, so the example
  // still runs when `auth` is dropped from the provider (the configuration where
  // a highlight tap is a silent no-op).
  const auth = useYVAuthOptional()
  const [status, setStatus] = useState<string | null>(null)
  const isDark = useColorScheme() === 'dark'
  const c = isDark ? dark : light

  const grantedPermissions = auth?.grantedPermissions ?? null
  const hasHighlights = grantedPermissions?.includes('highlights') ?? false

  async function grantHighlights() {
    if (!auth) return
    setStatus('Opening YouVersion…')
    const result = await auth.requestPermission('highlights')
    // `granted` means the exchange finished, not that we got what we asked for.
    setStatus(
      result.kind === 'granted'
        ? `Granted: ${result.permissions.join(', ') || '(nothing)'}`
        : result.kind === 'cancel'
          ? 'Cancelled'
          : `Failed: ${result.message}`,
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {auth === null ? (
        <Text style={[styles.muted, { color: c.muted }]} testID="auth-not-configured">
          Sign-in is not configured — pass an `auth` config to YouVersionProvider.
        </Text>
      ) : auth.isLoading ? (
        <Text style={[styles.muted, { color: c.muted }]}>Loading…</Text>
      ) : auth.isAuthenticated ? (
        <View style={styles.signedIn}>
          {auth.userInfo?.avatarUrl ? (
            <Image source={{ uri: auth.userInfo.avatarUrl }} style={styles.avatar} />
          ) : null}
          <Text style={[styles.muted, { color: c.muted }]}>You are signed in as</Text>
          <Text style={[styles.name, { color: c.fg }]}>{auth.userInfo?.name ?? '(no name)'}</Text>
          <Text style={[styles.email, { color: c.email }]}>
            {auth.userInfo?.email ?? '(no email)'}
          </Text>

          <Text style={[styles.muted, { color: c.muted, marginTop: 16 }]}>Permissions</Text>
          <Text style={[styles.permissions, { color: c.fg }]}>
            {grantedPermissions === null
              ? '(unknown)'
              : grantedPermissions.length === 0
                ? '(none granted)'
                : grantedPermissions.join(', ')}
          </Text>

          {/*
            A deliberate demo affordance, not the pattern to copy. It stays
            tappable even when the grant is already recorded: a real app prompts
            just-in-time (the reader already does — tap a colour without the
            permission), but the mirror is optimistic, so re-running the exchange
            is how you check it against the server and the only way to exercise
            the cancel path by hand.
          */}
          <Pressable
            accessibilityRole="button"
            onPress={grantHighlights}
            style={[styles.grantButton, { borderColor: c.fg }]}
          >
            <Text style={{ color: c.fg }}>
              {hasHighlights ? 'Re-check highlights access' : 'Grant highlights access'}
            </Text>
          </Pressable>
          {status ? (
            <Text style={[styles.muted, { color: c.muted }]} testID="permission-status">
              {status}
            </Text>
          ) : null}

          <View style={styles.button}>
            <YouVersionAuthButton mode="signOut" background={isDark ? 'dark' : 'light'} outline />
          </View>
        </View>
      ) : (
        <YouVersionAuthButton mode="signIn" background={isDark ? 'dark' : 'light'} outline />
      )}
    </View>
  )
}

const light = { bg: '#ffffff', fg: '#000000', muted: '#6b6b6b', email: '#3c3c3c' }
const dark = { bg: '#000000', fg: '#ffffff', muted: '#9b9b9b', email: '#c8c8c8' }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  signedIn: {
    alignItems: 'center',
    gap: 8,
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
  permissions: {
    fontSize: 15,
    fontWeight: '600',
  },
  grantButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  button: {
    marginTop: 16,
  },
})

import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import { YouVersionAuthButton } from '@youversion/platform-react-native-expo-ui'
import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'

export default function ProfileScreen() {
  const { isAuthenticated, isLoading, userInfo, grantedPermissions, requestPermission } =
    useYVAuth()
  const [status, setStatus] = useState<string | null>(null)
  const isDark = useColorScheme() === 'dark'
  const c = isDark ? dark : light

  const hasHighlights = grantedPermissions?.includes('highlights') ?? false

  async function grantHighlights() {
    setStatus('Opening YouVersion…')
    const result = await requestPermission('highlights')
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

          <Text style={[styles.muted, { color: c.muted, marginTop: 16 }]}>Permissions</Text>
          <Text style={[styles.permissions, { color: c.fg }]}>
            {grantedPermissions === null
              ? '(unknown)'
              : grantedPermissions.length === 0
                ? '(none granted)'
                : grantedPermissions.join(', ')}
          </Text>

          {/*
            Always tappable, even when the grant is already recorded. A real app
            would prompt just-in-time instead, but the mirror is optimistic —
            re-running the exchange is how you check it against the server, and
            it is the only way to exercise the cancel path by hand.
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

import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import { YouVersionAuthButton } from '@youversion/platform-react-native-expo-ui'
import { Image, StyleSheet, Text, useColorScheme, View } from 'react-native'

export default function ProfileScreen() {
  const { isAuthenticated, isLoading, userInfo } = useYVAuth()
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = colorTheme[colorScheme]

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Text style={[styles.muted, { color: theme.muted }]}>Loading…</Text>
      </View>
    )
  }

  if (isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.signedIn}>
          {userInfo?.avatarUrl ? (
            <Image source={{ uri: userInfo.avatarUrl }} style={styles.avatar} />
          ) : null}
          <Text style={[styles.muted, { color: theme.muted }]}>You are signed in as</Text>
          <Text style={[styles.name, { color: theme.fg }]}>{userInfo?.name ?? '(no name)'}</Text>
          <Text style={[styles.email, { color: theme.email }]}>
            {userInfo?.email ?? '(no email)'}
          </Text>
          <View style={styles.button}>
            <YouVersionAuthButton mode="signOut" background={colorScheme} outline />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <YouVersionAuthButton mode="signIn" background={colorScheme} outline />
    </View>
  )
}

const colorTheme = {
  light: { bg: '#ffffff', fg: '#000000', muted: '#6b6b6b', email: '#3c3c3c' },
  dark: { bg: '#000000', fg: '#ffffff', muted: '#9b9b9b', email: '#c8c8c8' },
} as const

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
  button: {
    marginTop: 16,
  },
})

import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export default function AuthDebugPanel() {
  const {
    isAuthenticated,
    isLoading,
    userInfo,
    signIn,
    signOut,
    refreshNow,
    error,
    accessToken,
    idToken,
  } = useYVAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (!__DEV__) return null

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshNow()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DEV — Auth state</Text>
      {isLoading && <Text style={styles.row}>loading...</Text>}
      <Text style={styles.row}>Signed in: {isAuthenticated ? 'yes' : 'no'}</Text>
      <Text style={styles.row}>User id: {userInfo?.id ?? '—'}</Text>
      <Text style={styles.row}>Name: {userInfo?.name ?? '—'}</Text>
      <Text style={styles.row}>Email: {userInfo?.email ?? '—'}</Text>
      <Text style={styles.row}>Avatar: {truncate(userInfo?.avatarUrl ?? null)}</Text>
      <Text style={styles.row}>Access token: {truncate(accessToken)}</Text>
      <Text style={styles.row}>Id token: {truncate(idToken)}</Text>
      {error && <Text style={styles.error}>Error: {error.message}</Text>}
      <View style={styles.buttons}>
        <Pressable style={styles.button} onPress={() => signIn().catch(() => {})}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => signOut().catch(() => {})}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
        <Pressable
          style={[styles.button, isRefreshing && styles.buttonDisabled]}
          disabled={isRefreshing}
          onPress={() => handleRefresh().catch(() => {})}
        >
          <Text style={styles.buttonText}>{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function truncate(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.length <= 12) return value
  return `${value.slice(0, 5)}...${value.slice(-5)}`
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fffbe6',
    borderColor: '#ffd54f',
    borderWidth: 1,
    borderRadius: 8,
    margin: 8,
    padding: 12,
  },
  title: { fontWeight: 'bold', marginBottom: 8 },
  row: { fontFamily: 'Menlo', fontSize: 12, marginVertical: 2 },
  error: { color: 'red', fontFamily: 'Menlo', fontSize: 12, marginVertical: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: 'bold' },
})

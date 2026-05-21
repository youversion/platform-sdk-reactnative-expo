import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export default function AuthDebugPanel() {
  if (!__DEV__) return null

  const { isAuthenticated, isLoading, userInfo, signIn, signOut, error } = useYVAuth()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DEV — Auth state</Text>
      {isLoading && <Text style={styles.row}>loading...</Text>}
      <Text style={styles.row}>Signed in: {isAuthenticated ? 'yes' : 'no'}</Text>
      {userInfo && (
        <Text style={styles.row}>
          User: {userInfo.name ?? '(no name)'} {userInfo.email ? `<${userInfo.email}>` : ''}
        </Text>
      )}
      {error && <Text style={styles.error}>Error: {error.message}</Text>}
      <View style={styles.buttons}>
        <Pressable style={styles.button} onPress={() => signIn().catch(() => {})}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => signOut().catch(() => {})}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  )
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
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
})

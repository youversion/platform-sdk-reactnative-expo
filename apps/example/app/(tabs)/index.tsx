import { View, Text, StyleSheet } from 'react-native'
import { BibleTextView } from '@youversion/platform-react-native-expo'

export default function BibleScreen() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY

  if (!appKey) {
    return (
      <View style={[styles.container, styles.missingKeyContainer]}>
        <Text style={styles.missingKeyTitle}>Missing app key</Text>
        <Text style={styles.missingKeyBody}>
          Set{' '}
          <Text style={styles.missingKeyCode}>EXPO_PUBLIC_YOUVERSION_APP_KEY</Text>{' '}
          in your environment (or an .env file) and restart the dev server.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BibleTextView
        appKey={appKey}
        reference="JHN.1.1-4"
        versionId={3034}
        showVerseNumbers
        style={styles.reader}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  missingKeyContainer: {
    padding: 16,
    gap: 8,
    justifyContent: 'center',
  },
  missingKeyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  missingKeyBody: {
    fontSize: 14,
    opacity: 0.85,
  },
  missingKeyCode: {
    fontFamily: 'Menlo',
  },
  reader: {
    flex: 1,
  },
})

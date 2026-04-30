import { View, Text, StyleSheet } from 'react-native'
import { VerseOfTheDay } from '@youversion/platform-react-native-expo'

export default function VerseOfTheDayScreen() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY

  if (!appKey) {
    return (
      <View style={[styles.container, styles.missingKeyContainer]}>
        <Text style={styles.missingKeyTitle}>Missing app key</Text>
        <Text style={styles.missingKeyBody}>
          Set EXPO_PUBLIC_YOUVERSION_APP_KEY in your environment (or an .env file) and restart
          the dev server.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>VerseOfTheDay</Text>
        <View style={styles.content}>
          <VerseOfTheDay appKey={appKey} versionId={3034} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  preview: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewLabel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    opacity: 0.7,
  },
  content: {
    padding: 16,
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
})

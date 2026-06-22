import { VerseOfTheDay } from '@youversion/platform-react-native-expo-ui'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function VerseOfTheDayScreen() {
  const { top } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top, backgroundColor: isDark ? '#000000' : '#ffffff' },
      ]}
    >
      <View style={styles.card}>
        <VerseOfTheDay versionId={3034} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
  },
})

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
      <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
})

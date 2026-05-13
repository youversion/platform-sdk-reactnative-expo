import { VerseOfTheDay } from '@youversion/platform-react-native-expo-ui'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function VerseOfTheDayScreen() {
  const { top } = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: top }]}>
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

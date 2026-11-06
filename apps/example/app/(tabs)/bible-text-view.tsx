import { BibleTextView } from '@youversion/platform-react-native-expo-ui'
import { ScrollView, StyleSheet, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function BibleTextViewScreen() {
  const { top } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const backgroundColor = isDark ? '#000000' : '#ffffff'

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: top + 12 }]}
      style={[styles.screen, { backgroundColor }]}
    >
      <BibleTextView reference="JHN.3.16" versionId={3034} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 12,
  },
})

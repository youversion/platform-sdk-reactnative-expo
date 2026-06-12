import { BibleReader } from '@youversion/platform-react-native-expo-ui'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function BibleScreen() {
  const isDark = useColorScheme() === 'dark'
  const { top } = useSafeAreaInsets()

  return (
    <View
      style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: top }]}
    >
      <BibleReader defaultVersionId={3034} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

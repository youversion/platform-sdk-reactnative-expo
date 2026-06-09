import { BibleReader } from '@youversion/platform-react-native-expo-ui'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function BibleScreen() {
  const { top } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top, backgroundColor: isDark ? '#000000' : '#ffffff' },
      ]}
    >
      <BibleReader
        dom={{
          scrollEnabled: false,
        }}
        defaultVersionId={3034}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

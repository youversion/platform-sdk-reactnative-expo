import { BibleReader } from '@youversion/platform-react-native-expo-ui'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { readerNavigation, setReaderVersionId } from '../../src/lib/reader-session'

export default function BibleScreen() {
  const { top } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: top },
      ]}
    >
      <BibleReader
        defaultVersionId={3034}
        navigation={readerNavigation}
        onVersionChange={(next) => {
          setReaderVersionId(next)
          return Promise.resolve()
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

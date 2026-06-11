import { BibleReader } from '@youversion/platform-react-native-expo-ui'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function BibleScreen() {
  const isDark = useColorScheme() === 'dark'
  const { top, bottom } = useSafeAreaInsets()

  return (
    <View
      style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: top }]}
    >
      {/* Pass the bottom inset (tab bar + home indicator) so the reader pads its
          scroll content and the closing attribution clears the tab bar. */}
      <BibleReader defaultVersionId={3034} bottomSafeArea={bottom} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

import { BibleCard } from '@youversion/platform-react-native-expo-ui'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function BibleCardScreen() {
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
        <BibleCard
          reference="JHN.3.16"
          versionId={3034}
          // flex: 0 lets the matchContents-measured height win over the
          // WebView container's default flex: 1 (whose 0% basis discards the
          // measured height); width: '100%' keeps the viewport determinate so
          // the DOM body has a real width to lay out against.
          dom={{ matchContents: true, containerStyle: { flex: 0, width: '100%' } }}
        />
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

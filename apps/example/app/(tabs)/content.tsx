import { StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colorTheme } from '../_components/color-theme'

export default function ContentScreen() {
  const { top } = useSafeAreaInsets()
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = colorTheme[colorScheme]

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: top }]}>
      <Text style={[styles.title, { color: theme.fg }]}>Content</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
})

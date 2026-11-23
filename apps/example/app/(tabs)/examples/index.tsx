import { Link, type Href } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colorTheme } from '../../../src/components/color-theme'

const examplesColorTheme = {
  light: { ...colorTheme.light, separator: '#c6c6c8' },
  dark: { ...colorTheme.dark, separator: '#38383a' },
} as const

const examples: { href: Href; title: string }[] = [
  { href: '/examples/verse-of-the-day', title: 'Verse of the Day' },
  { href: '/examples/bible-card', title: 'Bible Card' },
]

export default function ExamplesScreen() {
  const { top } = useSafeAreaInsets()
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = examplesColorTheme[colorScheme]

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: top }]}>
      <Text style={[styles.title, { color: theme.fg }]}>Examples</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {examples.map((example) => (
          <Link key={example.title} href={example.href} asChild>
            <Pressable accessibilityRole="button" style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.fg }]}>{example.title}</Text>
              <View style={[styles.separator, { backgroundColor: theme.separator }]} />
            </Pressable>
          </Link>
        ))}
      </ScrollView>
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
  list: {
    paddingTop: 16,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  rowLabel: {
    fontSize: 17,
  },
  separator: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
})

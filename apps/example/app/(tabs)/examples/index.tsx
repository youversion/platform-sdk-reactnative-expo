import { Link, type Href } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const colorTheme = {
  light: { bg: '#ffffff', fg: '#000000', separator: '#c6c6c8' },
  dark: { bg: '#000000', fg: '#ffffff', separator: '#38383a' },
} as const

const examples: { href: Href; title: string }[] = [
  { href: './verse-of-the-day', title: 'Verse of the Day' },
  { href: './bible-card', title: 'Bible Card' },
]

export default function ExamplesScreen() {
  const { top } = useSafeAreaInsets()
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = colorTheme[colorScheme]

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: top }]}>
      <Text style={[styles.title, { color: theme.fg }]}>Examples</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {examples.map((example) => (
          <Link key={example.title} href={example.href} asChild>
            <Pressable
              accessibilityRole="button"
              style={[styles.row, { borderBottomColor: theme.separator }]}
            >
              <Text style={[styles.rowLabel, { color: theme.fg }]}>{example.title}</Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 17,
  },
})

import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'

import { colorTheme } from '../../_components/color-theme'

export default function ExamplesLayout() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = colorTheme[colorScheme]

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.fg,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      {/* Title still feeds the child back button even while this header is hidden. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Examples' }} />
      <Stack.Screen name="verse-of-the-day" options={{ title: 'Verse of the Day' }} />
      <Stack.Screen name="bible-card" options={{ title: 'Bible Card' }} />
    </Stack>
  )
}

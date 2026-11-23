import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { Stack } from 'expo-router'

export default function ContentLayout() {
  const tokens = useTokens()

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.background },
        headerTintColor: tokens.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: tokens.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Content' }} />
      <Stack.Screen name="image" options={{ title: 'Verse image' }} />
    </Stack>
  )
}

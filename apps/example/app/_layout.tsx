import { Stack } from 'expo-router'
import { NativeSheetProvider } from '@youversion/platform-react-native-expo'

export default function RootLayout() {
  return (
    <NativeSheetProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </NativeSheetProvider>
  )
}

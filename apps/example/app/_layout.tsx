import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { NativeSheetProvider } from '@youversion/platform-react-native-expo'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NativeSheetProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NativeSheetProvider>
    </GestureHandlerRootView>
  )
}

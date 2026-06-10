import { BibleReader } from '@youversion/platform-react-native-expo-ui'
import { OrientationLock } from 'expo-screen-orientation'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { useLockOrientation } from '../_hooks/use-lock-orientation'

export default function BibleScreen() {
  const isDark = useColorScheme() === 'dark'
  useLockOrientation(OrientationLock.DEFAULT, OrientationLock.PORTRAIT_UP)

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <BibleReader defaultVersionId={3034} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

import { BibleReader, createBibleReaderNavigation } from '@youversion/platform-react-native-expo-ui'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function BibleScreen() {
  const { top } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const navigation = useMemo(() => createBibleReaderNavigation(), [])

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: top },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Focus John 3:16"
        onPress={() => {
          navigation.focusReference({
            versionId: 3034,
            bookId: 'JHN',
            chapter: 3,
            verse: 16,
          })
        }}
        style={styles.focus}
      >
        <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>John 3:16</Text>
      </Pressable>
      <BibleReader navigation={navigation} defaultVersionId={3034} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  focus: {
    alignItems: 'center',
    paddingVertical: 8,
  },
})

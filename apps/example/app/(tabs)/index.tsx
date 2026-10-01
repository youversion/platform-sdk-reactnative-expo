import { BibleReader, unstable_setReaderRenderer } from '@youversion/platform-react-native-expo-ui'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Renderer = 'dom' | 'native'

const RENDERERS: readonly Renderer[] = ['dom', 'native']

export default function BibleScreen() {
  const { top } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  // POC: set the impl before the first render so the reader mounts with it.
  const [renderer, setRenderer] = useState<Renderer>(() => {
    unstable_setReaderRenderer('native')
    return 'native'
  })

  const choose = (next: Renderer) => {
    unstable_setReaderRenderer(next)
    setRenderer(next)
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: top },
      ]}
    >
      {/* The key remounts the reader so it picks up the swapped impl. */}
      <BibleReader key={renderer} defaultVersionId={3034} />
      <View
        style={[styles.toggle, { top: top + 76, backgroundColor: isDark ? '#262626' : '#f0f0f0' }]}
      >
        {RENDERERS.map((option) => {
          const active = option === renderer
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => choose(option)}
              style={[styles.option, active && { backgroundColor: isDark ? '#ffffff' : '#121212' }]}
            >
              <Text style={[styles.label, { color: labelColor(active, isDark) }]}>
                {option === 'dom' ? 'DOM' : 'Native'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function labelColor(active: boolean, isDark: boolean): string {
  if (!active) {
    return isDark ? '#bfbfbf' : '#636363'
  }
  return isDark ? '#121212' : '#ffffff'
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggle: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    opacity: 0.92,
  },
  option: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
})

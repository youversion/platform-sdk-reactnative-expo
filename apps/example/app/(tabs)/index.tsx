import {
  BibleReader,
  type BibleReaderVerseSelection,
} from '@youversion/platform-react-native-expo-ui'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function BibleScreen() {
  const isDark = useColorScheme() === 'dark'
  const { top, bottom } = useSafeAreaInsets()

  const [selectedVerses, setSelectedVerses] = useState<BibleReaderVerseSelection | null>(
    null,
  )
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0)

  const onVerseSelect = useCallback(async (next: BibleReaderVerseSelection) => {
    console.log('[example] onVerseSelect', next.reference, next.verses)
    setSelectedVerses(next.verses.length > 0 ? next : null)
  }, [])

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: top },
      ]}
    >
      <BibleReader
        defaultVersionId={3034}
        onVerseSelect={onVerseSelect}
        clearSelectionSignal={clearSelectionSignal}
      />
      {selectedVerses ? (
        <View style={[styles.selectionBar, { bottom: bottom + 12 }]}>
          <Text style={styles.selectionLabel} numberOfLines={1}>
            {selectedVerses.reference}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setClearSelectionSignal((signal) => signal + 1)}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonLabel}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1f2933',
  },
  selectionLabel: {
    flexShrink: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#3e4c59',
  },
  clearButtonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
})

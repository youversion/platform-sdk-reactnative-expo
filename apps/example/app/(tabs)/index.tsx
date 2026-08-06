import {
  BibleReader,
  type BibleReaderShareData,
  type BibleReaderVerseSelection,
} from '@youversion/platform-react-native-expo-ui'
import * as Clipboard from 'expo-clipboard'
import { useCallback, useState } from 'react'
import { Pressable, Share, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * A verse tap opens the SDK's native verse action sheet: the reference, the
 * highlight swatches, Copy, and Share. Nothing on this screen opens the sheet.
 * The reader owns it.
 *
 * This screen shows the two things a host app can do around the sheet:
 *
 * 1. Observe the selection (`onVerseSelect`) and clear it (`clearSelectionSignal`).
 *    The strip under the header is app UI, not SDK UI. It sits at the top
 *    because the verse action sheet owns the bottom of the screen while a
 *    selection is live.
 * 2. Replace Copy and Share (`onCopy` / `onShare`). The toggle keeps the SDK
 *    fallbacks reachable, so a device can test both paths.
 */
export default function BibleScreen() {
  const isDark = useColorScheme() === 'dark'
  const { top } = useSafeAreaInsets()

  const [selectedVerses, setSelectedVerses] = useState<BibleReaderVerseSelection | null>(null)
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0)
  const [useCustomActions, setUseCustomActions] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const onVerseSelect = useCallback(async (next: BibleReaderVerseSelection) => {
    setSelectedVerses(next.verses.length > 0 ? next : null)
  }, [])

  // An override wins over the SDK's `expo-clipboard` and `Share.share`
  // fallbacks. `data.text` is the verse text plus the reference line. The other
  // fields are there so a host app can build its own string.
  const onCopy = useCallback(async (data: BibleReaderShareData) => {
    await Clipboard.setStringAsync(`${data.text}\n\nCopied from the example app`)
    setLastAction(`Custom copy: ${data.reference}`)
  }, [])

  const onShare = useCallback(async (data: BibleReaderShareData) => {
    await Share.share({ message: `${data.text}\n\nShared from the example app` })
    setLastAction(`Custom share: ${data.reference}`)
  }, [])

  const statusLabel = selectedVerses ? selectedVerses.reference : lastAction

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: top },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, { color: isDark ? '#ffffff' : '#121212' }]}>
          Custom Copy / Share
        </Text>
        <Switch value={useCustomActions} onValueChange={setUseCustomActions} />
      </View>

      {/* Always rendered, so selecting a verse does not resize the reader. */}
      <View style={styles.statusBar}>
        <Text style={styles.statusLabel} numberOfLines={1}>
          {statusLabel ?? 'Tap a verse to open the action sheet'}
        </Text>
        {statusLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setClearSelectionSignal((signal) => signal + 1)
              setLastAction(null)
            }}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <BibleReader
        defaultVersionId={3034}
        onVerseSelect={onVerseSelect}
        clearSelectionSignal={clearSelectionSignal}
        onCopy={useCustomActions ? onCopy : undefined}
        onShare={useCustomActions ? onShare : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    // Fixed height so showing the Clear button does not resize the reader.
    minHeight: 49,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1f2933',
  },
  statusLabel: {
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

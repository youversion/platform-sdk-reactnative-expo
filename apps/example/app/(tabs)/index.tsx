import type {
  BibleReaderHandle,
  HighlightWriteError,
} from '@youversion/platform-react-native-expo-ui'
import { BibleReader } from '@youversion/platform-react-native-expo-ui'
import { useFocusEffect } from 'expo-router'
import type { ComponentProps } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Derived from the component rather than imported, so the example doesn't take a
// direct dependency on the Web SDK's payload types.
type VerseSelectHandler = NonNullable<ComponentProps<typeof BibleReader>['onVerseSelect']>

const NOTICE_DURATION_MS = 4000

export default function BibleScreen() {
  const isDark = useColorScheme() === 'dark'
  const { top } = useSafeAreaInsets()
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const reader = useRef<BibleReaderHandle>(null)

  // ── Copy this pattern ──────────────────────────────────────────────────────
  // The SDK revalidates highlights on its own when the app returns from the
  // background, but it cannot see navigation focus without forcing a navigation
  // library on every consumer. So the host — which owns navigation — pulls the
  // latest whenever this screen comes back into view. That covers a highlight
  // created in the YouVersion app or on another device while the user was on a
  // different tab.
  //
  // It's cheap: the call de-dupes against a fetch already in flight, no-ops when
  // signed out, and never blanks what is already painted.
  useFocusEffect(
    useCallback(() => {
      void reader.current?.refreshHighlights()
    }, []),
  )

  // `onHighlightError` fires for writes that haven't reached the server yet. The
  // highlight stays painted, the write is persisted, and the SDK keeps retrying
  // with backoff — so this is a "still saving" hint, not a failure. Swap this
  // banner for your own toast system.
  const handleHighlightError = useCallback((error: HighlightWriteError) => {
    const verses = error.failedVerses.join(', ')
    setNotice({ id: Date.now(), text: `Saving verse ${verses}… queued, will retry.` })
  }, [])

  const handleVerseSelect = useCallback<VerseSelectHandler>(async (selection) => {
    // An observation of the reader's own selection — `verses: []` on clear.
    // Logged here so the payload is visible while integrating; a real app would
    // drive commentary, notes, or analytics from it.
    console.log('[example] onVerseSelect', JSON.stringify(selection))
  }, [])

  useEffect(() => {
    if (notice === null) return
    const timeout = setTimeout(() => setNotice(null), NOTICE_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [notice])

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: top },
      ]}
    >
      {notice ? (
        <View style={[styles.notice, { backgroundColor: isDark ? '#353333' : '#f6f4f4' }]}>
          <Text style={{ color: isDark ? '#ffffff' : '#000000' }} testID="highlight-notice">
            {notice.text}
          </Text>
        </View>
      ) : null}
      <BibleReader
        ref={reader}
        defaultVersionId={3034}
        onHighlightError={handleHighlightError}
        onVerseSelect={handleVerseSelect}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notice: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
})

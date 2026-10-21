import {
  BibleReader,
  type BibleReaderVerseSelection,
} from '@youversion/platform-react-native-expo-ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { READER_VERSION_ID, verseAtTime, verseStartSeconds, type AudioChapter } from './session'

export function GuidedReader({
  chapter,
  followSeconds,
  bottomInset,
  onSeek,
}: {
  chapter: AudioChapter
  followSeconds: number
  bottomInset: number
  onSeek: (seconds: number) => void
}) {
  const { top } = useSafeAreaInsets()
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0)
  const spokenVerse = verseAtTime(chapter.mockVerseTimings, followSeconds)

  async function onVerseSelect(selection: BibleReaderVerseSelection): Promise<void> {
    const { book, chapter: selectedChapter, verses } = selection
    const verse = verses[0]
    if (verse === undefined) return
    if (book !== chapter.bookId) return
    if (selectedChapter !== String(chapter.chapter)) return
    setClearSelectionSignal((signal) => signal + 1)
    const start = verseStartSeconds(chapter.mockVerseTimings, verse)
    if (start === null) return
    onSeek(start)
  }

  return (
    <View style={[styles.reader, { paddingTop: top }]}>
      <BibleReader
        book={chapter.bookId}
        chapter={String(chapter.chapter)}
        versionId={READER_VERSION_ID}
        showToolbar={false}
        onVerseSelect={onVerseSelect}
        clearSelectionSignal={clearSelectionSignal}
        bottomInset={bottomInset}
        spokenVerse={spokenVerse}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  reader: {
    flex: 1,
  },
})

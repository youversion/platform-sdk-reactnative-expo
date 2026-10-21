import {
  BibleReader,
  createBibleReaderNavigation,
  type BibleReaderVerseSelection,
} from '@youversion/platform-react-native-expo-ui'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  READER_VERSION_ID,
  nextFollowedVerse,
  verseStartSeconds,
  type AudioChapter,
} from './session'

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
  const [navigation] = useState(createBibleReaderNavigation)
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0)
  const followedRef = useRef<{ chapter: number; verse: number } | null>(null)

  useEffect(() => {
    const followed = followedRef.current
    let previousVerse: number | null = null
    if (followed !== null && followed.chapter === chapter.chapter) {
      previousVerse = followed.verse
    }
    const verse = nextFollowedVerse(chapter.mockVerseTimings, followSeconds, previousVerse)
    if (verse === null) return
    followedRef.current = { chapter: chapter.chapter, verse }
    navigation.focusReference({
      versionId: READER_VERSION_ID,
      bookId: chapter.bookId,
      chapter: chapter.chapter,
      verse,
    })
  }, [chapter, followSeconds, navigation])

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
        navigation={navigation}
        showToolbar={false}
        onVerseSelect={onVerseSelect}
        clearSelectionSignal={clearSelectionSignal}
        bottomInset={bottomInset}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  reader: {
    flex: 1,
  },
})

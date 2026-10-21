import { BibleReader } from '@youversion/platform-react-native-expo-ui'
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
  const spokenVerse = verseAtTime(chapter.mockVerseTimings, followSeconds)

  function onVersePress(verse: number): void {
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
        onVersePress={onVersePress}
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

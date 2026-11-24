import {
  BibleReader,
  getTokens,
  type BibleReaderVerseAction,
  type BibleReaderVerseRange,
  type VerseIndicatorStyleResolver,
  type VerseIndicatorTarget,
} from '@youversion/platform-react-native-expo-ui'
import { useCallback, useMemo, useState } from 'react'
import { Alert, StyleSheet, useColorScheme, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { DEFAULT_READER_VERSION_ID } from '../../../src/lib/reader-session'

/**
 * Figma marker chip: `Utility/Info` (`#3d79c2`) at 50% opacity. Over white that
 * reads as `blue20`; dark uses a soft mix of the DM info blue on the canvas.
 */
const MARKER_FILL = { light: '#9ebce1', dark: '#1e4b83' } as const

function BookmarkIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3h12v18l-6-4.5L6 21V3z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function verseKeys(range: BibleReaderVerseRange): string[] {
  const keys: string[] = []
  for (let verse = range.verseStart; verse <= range.verseEnd; verse += 1) {
    keys.push(`${range.versionId}:${range.book}.${range.chapter}.${verse}`)
  }
  return keys
}

/**
 * A custom "Bookmark" action plus a marker on every bookmarked verse number.
 * Bookmarks live in memory only; tapping a marker removes it.
 */
export default function VerseHooksScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const [bookmarks, setBookmarks] = useState<ReadonlySet<string>>(new Set())

  const verseActions = useMemo<BibleReaderVerseAction[]>(
    () => [
      'highlight',
      {
        id: 'bookmark',
        label: 'Bookmark',
        icon: BookmarkIcon,
        onPress: (references) => {
          setBookmarks((current) => new Set([...current, ...references.flatMap(verseKeys)]))
        },
      },
      'copy',
      'share',
    ],
    [],
  )

  const verseIndicatorStyle = useCallback<VerseIndicatorStyleResolver>(
    (target) => {
      if (!bookmarks.has(`${target.versionId}:${target.passageId}`)) {
        return null
      }
      const tokens = getTokens(scheme)
      return {
        backgroundColor: MARKER_FILL[scheme],
        foregroundColor: tokens.mutedForeground,
        inlinePadding: true,
        accessibilityLabel: `Bookmarked verse ${target.verse}`,
      }
    },
    [bookmarks, scheme],
  )

  const onVerseIndicatorPress = useCallback((target: VerseIndicatorTarget) => {
    Alert.alert(`Bookmark ${target.passageId}`, undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          setBookmarks((current) => {
            const next = new Set(current)
            next.delete(`${target.versionId}:${target.passageId}`)
            return next
          }),
      },
    ])
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: scheme === 'dark' ? '#000000' : '#ffffff' }]}>
      <BibleReader
        defaultVersionId={DEFAULT_READER_VERSION_ID}
        verseActions={verseActions}
        verseIndicatorStyle={verseIndicatorStyle}
        onVerseIndicatorPress={onVerseIndicatorPress}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

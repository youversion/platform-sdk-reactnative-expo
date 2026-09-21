import { useEffect, useRef, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useTokens } from '../../hooks/use-tokens'
import { useSdkTranslation } from '../../i18n/use-sdk-translation'
import { sansFace } from '../../theme/fonts'
import { ClearIcon } from '../icons/clear-icon'
import { InfoIcon } from '../icons/info-icon'
import { SearchIcon } from '../icons/search-icon'
import { Text } from '../ui'
import type { ChapterPickerBook, ChapterPickerOrder } from './chapter-picker-model'
import type { ChapterPickerLoadState } from './use-chapter-picker'

const SIDE_PADDING = 20
const GRID_GAP = 8
const CHAPTER_HEIGHT = 48
const MOTION_DURATION = 200

const accordionTransition = LinearTransition.duration(MOTION_DURATION)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System)

export type ChapterPickerContentProps = {
  loadState: ChapterPickerLoadState
  books: readonly ChapterPickerBook[]
  selectedBook: string
  selectedChapter: string
  query: string
  order: ChapterPickerOrder
  expandedBookId: string | null
  pendingChapterId: string | null
  style?: StyleProp<ViewStyle>
  onQueryChange: (query: string) => void
  onOrderChange: (order: ChapterPickerOrder) => void
  onExpandedBookChange: (bookId: string | null) => void
  onRetry: () => void
  onSelectChapter: (book: string, chapter: string) => void
}

function BookRow({
  book,
  expanded,
  selected,
  selectedChapter,
  pendingChapterId,
  onPress,
  onSelectChapter,
  onExpandedLayout,
  onSelectedLayout,
}: {
  book: ChapterPickerBook
  expanded: boolean
  selected: boolean
  selectedChapter: string
  pendingChapterId: string | null
  onPress: () => void
  onSelectChapter: (chapter: string) => void
  onExpandedLayout: (bookId: string, top: number, firstChapterBottom: number) => void
  onSelectedLayout: (key: string, top: number, bottom: number) => void
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()
  const selectedProgress = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    selectedProgress.value = withTiming(selected ? 1 : 0, {
      duration: MOTION_DURATION,
      reduceMotion: ReduceMotion.System,
    })
  }, [selected, selectedProgress])
  const selectedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      ['transparent', tokens.muted],
    ),
  }))
  const chapters = book.chapters
  const rowYRef = useRef<number | null>(null)
  const sectionYRef = useRef<number | null>(null)
  const gridYRef = useRef<number | null>(null)
  const firstChapterLayoutRef = useRef<{ y: number; height: number } | null>(null)
  const selectedChapterLayoutRef = useRef<{ id: string; y: number; height: number } | null>(null)

  useEffect(() => {
    if (!expanded) {
      sectionYRef.current = null
      gridYRef.current = null
      firstChapterLayoutRef.current = null
      selectedChapterLayoutRef.current = null
    }
  }, [expanded])

  const reportMeasuredLayouts = () => {
    const rowY = rowYRef.current
    if (rowY === null || !expanded) return

    const sectionY = sectionYRef.current
    const gridY = gridYRef.current
    const firstChapter = firstChapterLayoutRef.current
    if (sectionY !== null && gridY !== null && firstChapter !== null) {
      onExpandedLayout(
        book.id,
        rowY,
        rowY + sectionY + gridY + firstChapter.y + firstChapter.height,
      )
    } else if (chapters.length === 0 && book.intro === null) {
      onExpandedLayout(book.id, rowY, rowY + 58)
    }

    const selectedLayout = selectedChapterLayoutRef.current
    if (selected && sectionY !== null && gridY !== null && selectedLayout?.id === selectedChapter) {
      const top = rowY + sectionY + gridY + selectedLayout.y
      onSelectedLayout(
        `${book.id.toUpperCase()}.${selectedChapter}`,
        top,
        top + selectedLayout.height,
      )
    }
  }

  const recordChapterLayout = (chapterId: string, isFirst: boolean, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout
    if (isFirst) firstChapterLayoutRef.current = { y, height }
    if (selected && chapterId === selectedChapter) {
      selectedChapterLayoutRef.current = { id: chapterId, y, height }
    }
    reportMeasuredLayouts()
  }

  return (
    <Animated.View
      layout={accordionTransition}
      style={styles.bookContainer}
      onLayout={(event) => {
        rowYRef.current = event.nativeEvent.layout.y
        reportMeasuredLayouts()
      }}
    >
      <Animated.View style={[styles.bookRow, selectedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded, selected }}
          onPress={onPress}
          style={({ pressed }) => [styles.bookPressable, pressed && styles.pressed]}
        >
          <Text variant="body" style={[styles.bookTitle, { color: tokens.foreground }]}>
            {book.title}
          </Text>
        </Pressable>
      </Animated.View>
      {expanded ? (
        <View
          style={styles.chapterSection}
          onLayout={(event) => {
            sectionYRef.current = event.nativeEvent.layout.y
            reportMeasuredLayouts()
          }}
        >
          {chapters.length === 0 && book.intro === null ? (
            <Text variant="body" style={[styles.emptyChapters, { color: tokens.mutedForeground }]}>
              {t('noChaptersAvailable')}
            </Text>
          ) : (
            <View
              style={styles.chapterGrid}
              onLayout={(event) => {
                gridYRef.current = event.nativeEvent.layout.y
                reportMeasuredLayouts()
              }}
            >
              {book.intro !== null ? (
                <ChapterButton
                  label={book.intro.title}
                  accessibilityLabel={`${book.title} ${book.intro.title}`}
                  disabled={pendingChapterId !== null}
                  gridIndex={0}
                  selected={selected && selectedChapter === book.intro.id}
                  icon={<InfoIcon color={tokens.foreground} />}
                  onLayout={(event) => recordChapterLayout(book.intro?.id ?? '', true, event)}
                  onPress={() => onSelectChapter(book.intro?.id ?? '')}
                />
              ) : null}
              {chapters.map((item, index) => (
                <ChapterButton
                  key={item.id}
                  label={item.title}
                  accessibilityLabel={`${book.title} ${item.title}`}
                  disabled={pendingChapterId !== null}
                  gridIndex={index + (book.intro === null ? 0 : 1)}
                  selected={selected && selectedChapter === item.id}
                  onLayout={(event) =>
                    recordChapterLayout(item.id, index === 0 && book.intro === null, event)
                  }
                  onPress={() => onSelectChapter(item.id)}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </Animated.View>
  )
}

function ChapterButton({
  label,
  accessibilityLabel,
  disabled,
  gridIndex,
  selected,
  icon,
  onLayout,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  disabled: boolean
  gridIndex: number
  selected: boolean
  icon?: ReactNode
  onLayout?: (event: LayoutChangeEvent) => void
  onPress: () => void
}): ReactNode {
  const tokens = useTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onLayout={onLayout}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chapterButton,
        gridIndex % 5 !== 4 && styles.chapterButtonSpacing,
        { backgroundColor: tokens.muted, borderRadius: tokens.radius.surface },
        pressed && styles.pressed,
      ]}
    >
      {icon ?? (
        <Text variant="body" style={[styles.chapterLabel, { color: tokens.foreground }]}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export function ChapterPickerContent({
  loadState,
  books,
  selectedBook,
  selectedChapter,
  query,
  order,
  expandedBookId,
  pendingChapterId,
  style,
  onQueryChange,
  onOrderChange,
  onExpandedBookChange,
  onRetry,
  onSelectChapter,
}: ChapterPickerContentProps): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()
  const scrollRef = useRef<ScrollView>(null)
  const scrollY = useRef(0)
  const listHeight = useRef(0)
  const pendingExpandedBookId = useRef<string | null>(null)
  const pendingSelectedLayout = useRef<{ key: string; bottom: number } | null>(null)
  const focusedSelectionKey = useRef<string | null>(null)

  const focusSelectedChapter = () => {
    const selectedLayout = pendingSelectedLayout.current
    if (
      selectedLayout === null ||
      listHeight.current === 0 ||
      focusedSelectionKey.current === selectedLayout.key
    ) {
      return
    }
    focusedSelectionKey.current = selectedLayout.key
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, selectedLayout.bottom - listHeight.current + SIDE_PADDING),
        animated: false,
      })
    })
  }

  const scrollSelectedChapter = (key: string, _top: number, bottom: number) => {
    pendingSelectedLayout.current = { key, bottom }
    focusSelectedChapter()
  }

  const scrollExpandedBookIntoView = (bookId: string, top: number, firstChapterBottom: number) => {
    if (pendingExpandedBookId.current?.toUpperCase() !== bookId.toUpperCase()) return
    pendingExpandedBookId.current = null
    const viewportTop = scrollY.current
    const viewportBottom = viewportTop + listHeight.current
    if (top >= viewportTop + GRID_GAP && firstChapterBottom <= viewportBottom - GRID_GAP) return
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, top - GRID_GAP), animated: true })
    })
  }

  return (
    <View style={[styles.root, { backgroundColor: tokens.background }, style]}>
      <View style={[styles.search, { backgroundColor: tokens.input }]}>
        <SearchIcon color={tokens.mutedForeground} />
        <TextInput
          accessibilityLabel={t('search')}
          placeholder={t('search')}
          placeholderTextColor={tokens.mutedForeground}
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
          autoCorrect={false}
          style={[
            styles.searchInput,
            { color: tokens.foreground, ...sansFace(tokens.fontFamily.sans, 400) },
          ]}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('clearSearch')}
            hitSlop={10}
            onPress={() => onQueryChange('')}
          >
            <ClearIcon color={tokens.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <View
        style={styles.list}
        onLayout={(event) => {
          listHeight.current = event.nativeEvent.layout.height
          focusSelectedChapter()
        }}
      >
        <ScrollView
          ref={scrollRef}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
        >
          {loadState.status === 'loading' ? (
            <View style={styles.centerState}>
              <ActivityIndicator accessibilityLabel={t('loading')} color={tokens.foreground} />
            </View>
          ) : loadState.status === 'error' ? (
            <StateMessage label={t('error')} action={t('retry')} onAction={onRetry} />
          ) : books.length === 0 ? (
            <View style={styles.centerState}>
              <Text variant="body" style={{ color: tokens.mutedForeground }}>
                {t('noBibleSearchResults')}
              </Text>
            </View>
          ) : (
            <Animated.View
              key={order}
              entering={FadeIn.duration(MOTION_DURATION).reduceMotion(ReduceMotion.System)}
              exiting={FadeOut.duration(MOTION_DURATION).reduceMotion(ReduceMotion.System)}
            >
              {books.map((item) => (
                <BookRow
                  key={item.id}
                  book={item}
                  expanded={expandedBookId?.toUpperCase() === item.id.toUpperCase()}
                  selected={selectedBook.toUpperCase() === item.id.toUpperCase()}
                  selectedChapter={selectedChapter}
                  pendingChapterId={pendingChapterId}
                  onPress={() => {
                    const isExpanded = expandedBookId?.toUpperCase() === item.id.toUpperCase()
                    pendingExpandedBookId.current = isExpanded ? null : item.id
                    onExpandedBookChange(isExpanded ? null : item.id)
                  }}
                  onSelectChapter={(chapter) => onSelectChapter(item.id, chapter)}
                  onExpandedLayout={scrollExpandedBookIntoView}
                  onSelectedLayout={scrollSelectedChapter}
                />
              ))}
            </Animated.View>
          )}
        </ScrollView>
      </View>

      <View style={[styles.sortBar, { backgroundColor: tokens.muted, borderColor: tokens.border }]}>
        {(['traditional', 'alphabetical'] as const).map((value) => {
          const selected = order === value
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                Keyboard.dismiss()
                onOrderChange(value)
              }}
              style={[
                styles.sortOption,
                { borderRadius: tokens.radius.full },
                selected && { backgroundColor: tokens.background },
              ]}
            >
              <Text
                variant="body"
                style={[
                  styles.sortLabel,
                  { color: selected ? tokens.foreground : tokens.mutedForeground },
                ]}
              >
                {t(value)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function StateMessage({
  label,
  action,
  onAction,
}: {
  label: string
  action: string
  onAction: () => void
}): ReactNode {
  const tokens = useTokens()
  return (
    <View style={styles.centerState}>
      <Text variant="body" style={{ color: tokens.mutedForeground }}>
        {label}
      </Text>
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.retryButton}>
        <Text variant="body" style={[styles.retryLabel, { color: tokens.foreground }]}>
          {action}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: {
    height: 44,
    marginHorizontal: SIDE_PADDING,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, height: 44, fontSize: 16 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SIDE_PADDING, paddingBottom: 24 },
  centerState: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retryButton: { paddingHorizontal: 16, paddingVertical: 8 },
  retryLabel: { textDecorationLine: 'underline' },
  bookContainer: { overflow: 'hidden' },
  bookRow: { borderRadius: 14, overflow: 'hidden' },
  bookPressable: { minHeight: 58, justifyContent: 'center', paddingHorizontal: 16 },
  bookTitle: { fontSize: 18, lineHeight: 26 },
  pressed: { opacity: 0.65 },
  chapterSection: { paddingTop: 8, paddingBottom: 16 },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: GRID_GAP,
  },
  chapterButton: {
    width: '18.4%',
    height: CHAPTER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterButtonSpacing: { marginRight: '2%' },
  chapterLabel: { width: '100%', fontSize: 16, lineHeight: 20, textAlign: 'center' },
  emptyChapters: { paddingHorizontal: 16, paddingVertical: 18 },
  sortBar: {
    flexDirection: 'row',
    marginHorizontal: SIDE_PADDING,
    marginBottom: 12,
    padding: 4,
    borderWidth: 1,
    borderRadius: 9999,
  },
  sortOption: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  sortLabel: { fontSize: 14, lineHeight: 20 },
})

import { useEffect, useRef, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Line, Path } from 'react-native-svg'

import { useTokens } from '../../hooks/use-tokens'
import { useSdkTranslation } from '../../i18n/use-sdk-translation'
import { sansFace } from '../../theme/fonts'
import { Text } from '../ui'
import type { ChapterPickerBook, ChapterPickerOrder } from './chapter-picker-model'
import type { ChapterPickerLoadState } from './use-chapter-picker'

const SIDE_PADDING = 20
const GRID_GAP = 8
const CHAPTER_SIZE = 48
const MOTION_DURATION = 180

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

function SearchIcon({ color }: { color: string }): ReactNode {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Line x1={16} y1={16} x2={21} y2={21} stroke={color} strokeWidth={2} />
    </Svg>
  )
}

function ClearIcon({ color }: { color: string }): ReactNode {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M7 7l10 10M17 7L7 17" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

function InfoIcon({ color }: { color: string }): ReactNode {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Line x1={12} y1={11} x2={12} y2={17} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={7.5} r={1} fill={color} />
    </Svg>
  )
}

function BookRow({
  book,
  expanded,
  selected,
  selectedChapter,
  pendingChapterId,
  onPress,
  onSelectChapter,
  onSelectedLayout,
}: {
  book: ChapterPickerBook
  expanded: boolean
  selected: boolean
  selectedChapter: string
  pendingChapterId: string | null
  onPress: () => void
  onSelectChapter: (chapter: string) => void
  onSelectedLayout: (y: number) => void
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
      ['transparent', tokens.secondary],
    ),
  }))
  const chapters = book.chapters
  const selectedIndex = chapters.findIndex((item) => item.id === selectedChapter)
  const selectedGridIndex =
    book.intro?.id === selectedChapter
      ? 0
      : selectedIndex < 0
        ? -1
        : selectedIndex + (book.intro === null ? 0 : 1)
  const rowRef = useRef<View>(null)

  return (
    <Animated.View
      ref={rowRef}
      layout={LinearTransition.duration(MOTION_DURATION).reduceMotion(ReduceMotion.System)}
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
        <Animated.View
          entering={FadeIn.duration(MOTION_DURATION).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(MOTION_DURATION).reduceMotion(ReduceMotion.System)}
          style={styles.chapterSection}
          onLayout={(event) => {
            if (selected && selectedGridIndex >= 0) {
              const row = Math.floor(selectedGridIndex / 5)
              const chapterOffset = event.nativeEvent.layout.y + row * (CHAPTER_SIZE + GRID_GAP)
              rowRef.current?.measure((_x, _y, _width, _height, _pageX, pageY) => {
                onSelectedLayout(pageY + chapterOffset)
              })
            }
          }}
        >
          {chapters.length === 0 && book.intro === null ? (
            <Text variant="body" style={[styles.emptyChapters, { color: tokens.mutedForeground }]}>
              {t('noChaptersAvailable')}
            </Text>
          ) : (
            <View style={styles.chapterGrid}>
              {book.intro !== null ? (
                <ChapterButton
                  label={book.intro.title}
                  accessibilityLabel={`${book.title} ${book.intro.title}`}
                  disabled={pendingChapterId !== null}
                  gridIndex={0}
                  pending={pendingChapterId === `${book.id}.${book.intro.id}`}
                  selected={selected && selectedChapter === book.intro.id}
                  icon={<InfoIcon color={tokens.foreground} />}
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
                  pending={pendingChapterId === `${book.id}.${item.id}`}
                  selected={selected && selectedChapter === item.id}
                  onPress={() => onSelectChapter(item.id)}
                />
              ))}
            </View>
          )}
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

function ChapterButton({
  label,
  accessibilityLabel,
  disabled,
  gridIndex,
  pending,
  selected,
  icon,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  disabled: boolean
  gridIndex: number
  pending: boolean
  selected: boolean
  icon?: ReactNode
  onPress: () => void
}): ReactNode {
  const tokens = useTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chapterButton,
        gridIndex % 5 !== 4 && styles.chapterButtonSpacing,
        { backgroundColor: tokens.muted, borderRadius: tokens.radius.surface },
        pressed && styles.pressed,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={tokens.foreground} />
      ) : (
        (icon ?? (
          <Text variant="body" style={[styles.chapterLabel, { color: tokens.foreground }]}>
            {label}
          </Text>
        ))
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
  const scrollFrameRef = useRef<View>(null)
  const scrollY = useRef(0)

  const scrollSelectedChapter = (pageY: number) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollFrameRef.current?.measure((_x, _y, _width, _height, _pageX, scrollPageY) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollY.current + pageY - scrollPageY - CHAPTER_SIZE),
            animated: true,
          })
        })
      })
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

      <View ref={scrollFrameRef} style={styles.list}>
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
          ) : loadState.books.length === 0 ? (
            <StateMessage label={t('noBooksAvailable')} action={t('retry')} onAction={onRetry} />
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
                  expanded={expandedBookId === item.id}
                  selected={selectedBook.toUpperCase() === item.id.toUpperCase()}
                  selectedChapter={selectedChapter}
                  pendingChapterId={pendingChapterId}
                  onPress={() => onExpandedBookChange(expandedBookId === item.id ? null : item.id)}
                  onSelectChapter={(chapter) => onSelectChapter(item.id, chapter)}
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
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterButtonSpacing: { marginRight: '2%' },
  chapterLabel: { fontSize: 16, lineHeight: 22 },
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

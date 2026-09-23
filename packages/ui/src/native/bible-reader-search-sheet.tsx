import {
  bibleReferenceFromUsfm,
  type FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'
import { useBibleReaderSearch } from '../hooks/use-bible-reader-search'
import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import {
  languageRangesForVersionLanguage,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_SNIPPET_LINE_COUNT,
  type TitledVerse,
} from '../lib/bible-reader-search'
import type { ResultsFooter, SearchView } from '../lib/bible-reader-search-view'
import type { Theme } from '../lib/resolve-theme'
import type { Tokens } from '../theme'
import { sansFace } from '../theme/fonts'
import type { BibleReaderFocusTarget } from './bible-reader-navigation'
import { getImpl, registerDefault } from './component-impls'
import { RecentIcon, SearchIcon, TrendingIcon } from './icons'
import { NativeSheet } from './native-sheet'

const PAN_ACTIVE_OFFSET_Y: [number, number] = [-10, 10]
const CHIP_GLYPH_SIZE = 32
const CHIP_ICON_SIZE = 24

export type BibleReaderSearchSheetProps = {
  isOpen: boolean
  onClose: () => void
  versionId: number
  languageTag?: string | null
  theme: Theme
  fetchBibleContent: FetchBibleContent
  onSelectReference: (reference: BibleReaderFocusTarget) => void
}

function BibleReaderSearchSheetImpl({
  isOpen,
  onClose,
  versionId,
  languageTag,
  theme,
  fetchBibleContent,
  onSelectReference,
}: BibleReaderSearchSheetProps): ReactNode {
  const { t } = useSdkTranslation()
  const tokens = useTokens()
  const { height } = useWindowDimensions()
  const languageRanges = languageRangesForVersionLanguage(languageTag)
  const search = useBibleReaderSearch({
    versionId,
    isOpen,
    fetchBibleContent,
    languageRanges,
  })

  const listHeight = Math.round(height * 0.5)
  const showClear = search.query.length > 0
  const { view } = search
  const fieldRef = useRef<TextInput>(null)

  // NativeSheet keeps children mounted while closed, so autoFocus would steal
  // the keyboard on first mount and would not run again on the next open.
  useEffect(() => {
    if (isOpen) {
      fieldRef.current?.focus()
      return
    }
    fieldRef.current?.blur()
  }, [isOpen])

  const handleSelectVerse = (usfm: TitledVerse['usfm']) => {
    const reference = bibleReferenceFromUsfm(usfm, versionId)
    if (reference === null) {
      return
    }
    onClose()
    onSelectReference({ ...reference, passageId: usfm })
  }

  const handleDismissKeyboardStart = () => {
    fieldRef.current?.blur()
  }

  return (
    <NativeSheet
      isOpen={isOpen}
      onClose={onClose}
      onDismissKeyboardStart={handleDismissKeyboardStart}
      theme={theme}
      enableContentPanningGesture
      panActiveOffsetY={PAN_ACTIVE_OFFSET_Y}
      contentStyle={styles.sheetContent}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <View
            style={[
              styles.field,
              { backgroundColor: tokens.input, borderRadius: tokens.radius.full },
            ]}
          >
            <SearchIcon color={tokens.mutedForeground} size={24} />
            <TextInput
              ref={fieldRef}
              testID="bible-reader-search-field"
              value={search.query}
              onChangeText={search.setQuery}
              onSubmitEditing={() => search.submit(search.query)}
              maxLength={SEARCH_QUERY_MAX_LENGTH}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              placeholder={t('search')}
              placeholderTextColor={tokens.mutedForeground}
              accessibilityLabel={t('search')}
              style={[
                styles.searchInput,
                sansFace(tokens.fontFamily.sans, 400),
                { color: tokens.foreground },
              ]}
            />
            {showClear && (
              <Pressable
                testID="bible-reader-search-clear"
                accessibilityRole="button"
                accessibilityLabel={t('bibleSearchClearAriaLabel')}
                onPress={() => search.setQuery('')}
                style={({ pressed }) => {
                  if (pressed) {
                    return [styles.clear, styles.clearPressed]
                  }
                  return styles.clear
                }}
              >
                <Text style={{ color: tokens.mutedForeground, ...tokens.typography.sm }}>×</Text>
              </Pressable>
            )}
          </View>
          <Button
            testID="bible-reader-search-cancel"
            variant="ghost"
            onPress={onClose}
            accessibilityLabel={t('cancel')}
          >
            <Button.Text>{t('cancel')}</Button.Text>
          </Button>
        </View>
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <SearchBody
          view={view}
          tokens={tokens}
          listHeight={listHeight}
          scrollGeneration={search.scrollGeneration}
          onSubmit={search.submit}
          onSelectVerse={handleSelectVerse}
          loadingLabel={t('loading')}
          trendingHeading={t('bibleSearchTrendingHeading')}
          recentHeading={t('bibleSearchRecentHeading')}
          emptyCopy={t('noBibleSearchResults')}
          retryCopy={t('retry')}
        />
      </View>
    </NativeSheet>
  )
}

type SearchBodyProps = {
  view: SearchView
  tokens: Tokens
  listHeight: number
  scrollGeneration: number
  onSubmit: (text: string) => void
  onSelectVerse: (usfm: TitledVerse['usfm']) => void
  loadingLabel: string
  trendingHeading: string
  recentHeading: string
  emptyCopy: string
  retryCopy: string
}

function SearchBody({
  view,
  tokens,
  listHeight,
  scrollGeneration,
  onSubmit,
  onSelectVerse,
  loadingLabel,
  trendingHeading,
  recentHeading,
  emptyCopy,
  retryCopy,
}: SearchBodyProps): ReactNode {
  if (view.phase === 'browsing') {
    return (
      <ScrollView
        style={{ height: listHeight }}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="heading">{trendingHeading}</Text>
        {view.trending.status === 'loading' ? (
          <View style={styles.status} testID="bible-reader-search-loading">
            <ActivityIndicator color={tokens.foreground} accessibilityLabel={loadingLabel} />
          </View>
        ) : (
          view.trending.value.map((query) => (
            <QueryChip
              key={`trending-${query}`}
              text={query}
              kind="trending"
              tokens={tokens}
              onPress={() => onSubmit(query)}
            />
          ))
        )}
        {view.recents.length > 0 ? (
          <>
            <Text variant="heading" style={styles.recentHeading}>
              {recentHeading}
            </Text>
            {view.recents.map((query) => (
              <QueryChip
                key={`recent-${query}`}
                text={query}
                kind="recent"
                tokens={tokens}
                onPress={() => onSubmit(query)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    )
  }

  if (view.phase === 'suggesting') {
    return (
      <FlatList
        data={[...view.suggestions]}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <Pressable
            testID={`bible-reader-search-suggestion-${item}`}
            accessibilityRole="button"
            onPress={() => onSubmit(item)}
            style={styles.row}
          >
            <Text style={{ color: tokens.foreground }}>{item}</Text>
          </Pressable>
        )}
        style={{ height: listHeight }}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    )
  }

  if (view.phase === 'pending') {
    return (
      <View
        style={[styles.statusFill, { height: listHeight }]}
        testID="bible-reader-search-loading"
      >
        <ActivityIndicator color={tokens.foreground} accessibilityLabel={loadingLabel} />
      </View>
    )
  }

  if (view.phase === 'results') {
    return (
      <FlatList
        key={scrollGeneration}
        data={[...view.verses]}
        keyExtractor={(item) => item.usfm}
        renderItem={({ item }) => (
          <Pressable
            testID={`bible-reader-search-result-${item.usfm}`}
            accessibilityRole="button"
            onPress={() => onSelectVerse(item.usfm)}
            style={styles.resultPress}
          >
            <View style={[styles.accent, { backgroundColor: tokens.foreground }]} />
            <View style={styles.resultCopy}>
              <Text numberOfLines={SEARCH_SNIPPET_LINE_COUNT} style={{ color: tokens.foreground }}>
                {item.snippet}
              </Text>
              <Text
                variant="muted"
                style={{
                  textTransform: 'uppercase',
                  ...sansFace(tokens.fontFamily.sans, 700),
                }}
              >
                {item.title}
              </Text>
            </View>
          </Pressable>
        )}
        style={{ height: listHeight }}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onEndReached={view.onEndReached}
        onEndReachedThreshold={0.2}
        ListFooterComponent={resultsFooter(view.footer, tokens, loadingLabel, retryCopy)}
      />
    )
  }

  if (view.phase === 'empty') {
    return (
      <View style={[styles.statusFill, { height: listHeight }]} testID="bible-reader-search-empty">
        <Text variant="muted">{emptyCopy}</Text>
      </View>
    )
  }

  return (
    <Pressable
      testID="bible-reader-search-error"
      accessibilityRole="button"
      accessibilityLabel={retryCopy}
      onPress={view.onRetry}
      style={[styles.statusFill, { height: listHeight }]}
    >
      <Text style={{ color: tokens.destructive }}>{retryCopy}</Text>
    </Pressable>
  )
}

function resultsFooter(
  footer: ResultsFooter,
  tokens: Tokens,
  loadingLabel: string,
  retryCopy: string,
): ReactElement | null {
  if (footer.kind === 'loading') {
    return (
      <View style={styles.status} testID="bible-reader-search-page-loading">
        <ActivityIndicator color={tokens.foreground} accessibilityLabel={loadingLabel} />
      </View>
    )
  }
  if (footer.kind === 'error') {
    return (
      <Pressable
        testID="bible-reader-search-page-error"
        accessibilityRole="button"
        accessibilityLabel={retryCopy}
        onPress={footer.onRetry}
        style={styles.status}
      >
        <Text style={{ color: tokens.destructive }}>{retryCopy}</Text>
      </Pressable>
    )
  }
  return null
}

function QueryChip({
  text,
  kind,
  tokens,
  onPress,
}: {
  text: string
  kind: 'trending' | 'recent'
  tokens: Tokens
  onPress: () => void
}): ReactNode {
  const Icon = kind === 'trending' ? TrendingIcon : RecentIcon
  return (
    <Pressable
      testID={`bible-reader-search-suggestion-${text}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.chip}
    >
      <View
        style={[
          styles.chipGlyph,
          { backgroundColor: tokens.muted, borderRadius: tokens.radius.full },
        ]}
      >
        <Icon color={tokens.mutedForeground} size={CHIP_ICON_SIZE} />
      </View>
      <Text style={{ color: tokens.foreground, flex: 1 }}>{text}</Text>
    </Pressable>
  )
}

registerDefault('BibleReaderSearchSheet', BibleReaderSearchSheetImpl)

export function BibleReaderSearchSheet(props: BibleReaderSearchSheetProps): ReactNode {
  const Impl = getImpl('BibleReaderSearchSheet')
  return <Impl {...props} />
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 0,
  },
  body: {
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  field: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  clear: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  clearPressed: {
    opacity: 0.8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  recentHeading: {
    marginTop: 16,
  },
  row: {
    paddingVertical: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  chipGlyph: {
    width: CHIP_GLYPH_SIZE,
    height: CHIP_GLYPH_SIZE,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPress: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingVertical: 12,
  },
  accent: {
    width: 3,
    borderRadius: 2,
  },
  resultCopy: {
    flex: 1,
    gap: 7,
  },
  status: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  statusFill: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
})

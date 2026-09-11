import {
  bibleReferenceFromUsfm,
  type BibleReference,
  type FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'
import { useCallback, useMemo, type ReactNode } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ListRenderItem,
  type ViewToken,
} from 'react-native'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Text } from '../components/ui/text'
import { useBibleReaderSearch } from '../hooks/use-bible-reader-search'
import { useTokens } from '../hooks/use-tokens'
import { useLocale } from '../i18n/locale-context'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import {
  languageRangesForLocale,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_SNIPPET_LINE_COUNT,
  shouldRequestNextPage,
} from '../lib/bible-reader-search'
import type { Theme } from '../lib/resolve-theme'
import { getImpl, registerDefault } from './component-impls'
import { NativeSheet } from './native-sheet'

const PAN_ACTIVE_OFFSET_Y: [number, number] = [-10, 10]

export type BibleReaderSearchSheetProps = {
  isOpen: boolean
  onClose: () => void
  versionId: number
  theme: Theme
  fetchBibleContent: FetchBibleContent
  onSelectReference: (reference: BibleReference) => void
}

type SuggestionRow = {
  kind: 'suggestion'
  key: string
  text: string
}

type VerseRow = {
  kind: 'verse'
  key: string
  usfm: string
  title: string
  snippet: string | null
}

type ListRow = SuggestionRow | VerseRow

function BibleReaderSearchSheetImpl({
  isOpen,
  onClose,
  versionId,
  theme,
  fetchBibleContent,
  onSelectReference,
}: BibleReaderSearchSheetProps): ReactNode {
  const { t } = useSdkTranslation()
  const { lng } = useLocale()
  const tokens = useTokens()
  const { height } = useWindowDimensions()
  const languageRanges = useMemo(() => languageRangesForLocale(lng), [lng])
  const search = useBibleReaderSearch({
    versionId,
    isOpen,
    fetchBibleContent,
    languageRanges,
  })

  const listHeight = Math.round(height * 0.5)
  const showClear = search.query.length > 0

  const rows = useMemo((): ListRow[] => {
    if (search.showingResults) {
      return search.verses.map((verse) => ({
        kind: 'verse' as const,
        key: verse.usfm,
        usfm: verse.usfm,
        title: verse.title,
        snippet: verse.snippet,
      }))
    }
    return search.suggestions.map((suggestion, index) => ({
      kind: 'suggestion' as const,
      key: `${suggestion.text}-${index}`,
      text: suggestion.text,
    }))
  }, [search.showingResults, search.suggestions, search.verses])

  const handleSelectVerse = (usfm: string) => {
    const reference = bibleReferenceFromUsfm(usfm, versionId)
    if (reference === null) {
      return
    }
    onClose()
    onSelectReference(reference)
  }

  const renderItem: ListRenderItem<ListRow> = ({ item }) => {
    if (item.kind === 'suggestion') {
      return (
        <Pressable
          testID={`bible-reader-search-suggestion-${item.text}`}
          accessibilityRole="button"
          onPress={() => search.submit(item.text)}
          style={styles.row}
        >
          <Text style={{ color: tokens.foreground }}>{item.text}</Text>
        </Pressable>
      )
    }
    return (
      <Pressable
        testID={`bible-reader-search-result-${item.usfm}`}
        accessibilityRole="button"
        onPress={() => handleSelectVerse(item.usfm)}
        style={styles.row}
      >
        <Text style={{ color: tokens.primary }}>{item.title}</Text>
        {item.snippet !== null && (
          <Text numberOfLines={SEARCH_SNIPPET_LINE_COUNT} style={{ color: tokens.foreground }}>
            {item.snippet}
          </Text>
        )}
        <Text variant="muted">{item.usfm}</Text>
      </Pressable>
    )
  }

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!search.showingResults) {
        return
      }
      let highest = -1
      for (const token of viewableItems) {
        if (token.index === null || token.index === undefined) {
          continue
        }
        if (token.index > highest) {
          highest = token.index
        }
      }
      if (shouldRequestNextPage(highest, search.verses.length)) {
        search.loadNextPage()
      }
    },
    [search],
  )

  const showLoading =
    (search.showingResults && search.isLoadingSearch) ||
    (!search.showingResults && search.isLoadingSuggestions)
  const showSearchError = search.showingResults && search.searchError !== null
  const showPageError = search.showingResults && search.pageError !== null
  const showEmpty = search.hasNoResults

  return (
    <NativeSheet
      isOpen={isOpen}
      onClose={onClose}
      theme={theme}
      showHeader
      headerTitle={t('search')}
      enableContentPanningGesture
      panActiveOffsetY={PAN_ACTIVE_OFFSET_Y}
      contentStyle={styles.sheetContent}
    >
      <View style={styles.body}>
        <Input>
          <Input.Field
            testID="bible-reader-search-field"
            value={search.query}
            onChangeText={search.setQuery}
            onSubmitEditing={() => search.submit(search.query)}
            maxLength={SEARCH_QUERY_MAX_LENGTH}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            placeholder={t('search')}
            accessibilityLabel={t('search')}
          />
          {showClear && (
            <Input.Clear
              testID="bible-reader-search-clear"
              accessibilityLabel={t('cancel')}
              onPress={() => search.setQuery('')}
            />
          )}
        </Input>
        {showLoading && (
          <View style={styles.status} testID="bible-reader-search-loading">
            <ActivityIndicator color={tokens.foreground} accessibilityLabel={t('loading')} />
          </View>
        )}
        {showSearchError && (
          <Pressable
            testID="bible-reader-search-error"
            accessibilityRole="button"
            onPress={search.retrySearch}
            style={styles.status}
          >
            <Text style={{ color: tokens.destructive }}>{t('error')}</Text>
          </Pressable>
        )}
        {showEmpty && (
          <View style={styles.status} testID="bible-reader-search-empty">
            <Text variant="muted">{t('noBibleSearchResults')}</Text>
          </View>
        )}
        <FlatList
          key={search.scrollGeneration}
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          style={{ height: listHeight }}
          keyboardShouldPersistTaps="handled"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY}
        />
        {search.isLoadingPage && (
          <View style={styles.status} testID="bible-reader-search-page-loading">
            <ActivityIndicator color={tokens.foreground} accessibilityLabel={t('loading')} />
          </View>
        )}
        {showPageError && (
          <Pressable
            testID="bible-reader-search-page-error"
            accessibilityRole="button"
            onPress={search.retryPage}
            style={styles.status}
          >
            <Text style={{ color: tokens.destructive }}>{t('error')}</Text>
          </Pressable>
        )}
        <Button variant="ghost" onPress={onClose} style={styles.done}>
          <Button.Text>{t('ok')}</Button.Text>
        </Button>
      </View>
    </NativeSheet>
  )
}

const VIEWABILITY = { itemVisiblePercentThreshold: 10 }

registerDefault('BibleReaderSearchSheet', BibleReaderSearchSheetImpl)

export function BibleReaderSearchSheet(props: BibleReaderSearchSheetProps): ReactNode {
  const Impl = getImpl('BibleReaderSearchSheet')
  return <Impl {...props} />
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 16,
  },
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  row: {
    paddingVertical: 12,
    gap: 4,
  },
  status: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  done: {
    alignSelf: 'flex-end',
  },
})

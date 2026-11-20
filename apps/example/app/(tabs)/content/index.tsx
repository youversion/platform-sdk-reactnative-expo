import type { YouVersionImage } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ContentKindSwitch, type ContentKind } from '../../../src/components/content-kind-switch'
import { VerseImage } from '../../../src/components/verse-image'
import { VideoCollections } from '../../../src/components/video-collections'
import { formatPassageLabel } from '../../../src/lib/passage-label'
import { rememberOpenedImage } from '../../../src/lib/opened-images'
import { useBookTitles } from '../../../src/lib/use-book-titles'
import { useContentImages } from '../../../src/lib/use-content-images'
import { useContentLanguage } from '../../../src/lib/use-content-language'
import { useReaderVersionId } from '../../../src/lib/reader-session'

export default function ContentScreen() {
  const [kind, setKind] = useState<ContentKind>('images')
  if (kind === 'videos') return <VideoCollections onKindChange={setKind} />
  return <ImageCollections onKindChange={setKind} />
}

function ImageCollections({ onKindChange }: { onKindChange: (kind: ContentKind) => void }) {
  const tokens = useTokens()
  const { bottom } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const versionId = useReaderVersionId()
  const language = useContentLanguage()
  const titles = useBookTitles(versionId)
  const library = useContentImages(versionId, language)
  const cellWidth = (width - 40 - 16) / 2
  const blocked = library.validation !== null
  const showEmpty =
    !blocked && !library.loading && library.error === null && library.list.items.length === 0
  const showLoadMore =
    !blocked && !library.loading && library.error === null && library.list.nextPageToken !== null

  // A first-page error shows under the search field; a Load more error shows where the button was.
  const showError = !blocked && library.error !== null
  const errorAtTop = library.list.items.length === 0
  const errorRow = showError ? (
    <View style={styles.errorRow}>
      <Text style={[styles.message, { color: tokens.destructive }]}>{library.error}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={library.retry}
        style={[styles.button, { borderColor: tokens.border, borderRadius: tokens.radius.full }]}
      >
        <Text style={{ color: tokens.foreground }}>Retry</Text>
      </Pressable>
    </View>
  ) : null

  const openImage = useCallback((image: YouVersionImage) => {
    rememberOpenedImage(image)
    router.push({ pathname: '/content/image', params: { id: image.id } })
  }, [])

  return (
    <FlatList
      columnWrapperStyle={styles.row}
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
      data={blocked ? [] : library.list.items}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        showEmpty ? (
          <Text style={[styles.empty, { color: tokens.mutedForeground }]}>
            {library.submittedQuery === ''
              ? 'No images found'
              : `There are no images for ${library.submittedQuery}`}
          </Text>
        ) : null
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {library.loading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
          {showError && !errorAtTop ? errorRow : null}
          {showLoadMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={library.loadMore}
              style={[
                styles.button,
                { borderColor: tokens.border, borderRadius: tokens.radius.full },
              ]}
            >
              <Text style={{ color: tokens.foreground }}>Load more</Text>
            </Pressable>
          ) : null}
        </View>
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: tokens.foreground }]}>
            Content
          </Text>
          <ContentKindSwitch kind="images" onChange={onKindChange} />
          <View
            style={[
              styles.search,
              { backgroundColor: tokens.muted, borderRadius: tokens.radius.full },
            ]}
          >
            <TextInput
              accessibilityLabel="Search images"
              autoCapitalize="sentences"
              autoCorrect={false}
              onChangeText={library.setQuery}
              onSubmitEditing={() => library.submit(library.query)}
              placeholder="Search by verse reference"
              placeholderTextColor={tokens.mutedForeground}
              returnKeyType="search"
              style={[styles.input, { color: tokens.foreground }]}
              value={library.query}
            />
            {library.query.length === 0 ? null : (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={library.clear}
              >
                <Text style={{ color: tokens.mutedForeground }}>Clear</Text>
              </Pressable>
            )}
          </View>
          {library.validation === null ? null : (
            <Text style={[styles.message, { color: tokens.mutedForeground }]}>
              {library.validation}
            </Text>
          )}
          {errorAtTop ? errorRow : null}
        </View>
      }
      numColumns={2}
      renderItem={({ item }) => (
        <Pressable
          accessibilityLabel={formatPassageLabel(item.passage_id, titles)}
          accessibilityRole="button"
          onPress={() => openImage(item)}
          style={{ width: cellWidth }}
        >
          <VerseImage frame="square" image={item} presentation="standard" size="thumb" />
          <Text numberOfLines={2} style={[styles.caption, { color: tokens.foreground }]}>
            {formatPassageLabel(item.passage_id, titles)}
          </Text>
        </Pressable>
      )}
      style={{ backgroundColor: tokens.background }}
    />
  )
}

const styles = StyleSheet.create({
  header: {
    gap: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    paddingTop: 16,
  },
  search: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  message: {
    fontSize: 15,
  },
  errorRow: {
    gap: 8,
  },
  row: {
    gap: 16,
    paddingHorizontal: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 6,
  },
  empty: {
    fontSize: 16,
    paddingHorizontal: 20,
    paddingTop: 24,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  button: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
})

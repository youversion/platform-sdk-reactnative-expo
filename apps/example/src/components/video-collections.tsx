import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { router } from 'expo-router'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { rememberCollection } from '../lib/opened-videos'
import { collectionsByTitle, type ListedCollection } from '../lib/playlist-videos'
import { useContentLanguage } from '../lib/use-content-language'
import { useContentPlaylists } from '../lib/use-content-playlists'
import { ContentKindSwitch, type ContentKind } from './content-kind-switch'
import { VideoThumbnail } from './video-thumbnail'

type VideoCollectionsProps = {
  onKindChange: (kind: ContentKind) => void
}

export function VideoCollections({ onKindChange }: VideoCollectionsProps) {
  const tokens = useTokens()
  const { bottom } = useSafeAreaInsets()
  const language = useContentLanguage()
  const library = useContentPlaylists(language)
  const collections = collectionsByTitle(library.list.items)
  const featured = collections[0] ?? null
  const showEmpty = !library.loading && library.error === null && collections.length === 0
  const showLoadMore =
    !library.loading && library.error === null && library.list.nextPageToken !== null
  const showError = library.error !== null
  const errorAtTop = collections.length === 0

  const openCollection = useCallback((collection: ListedCollection) => {
    rememberCollection(collection)
    router.push({ pathname: '/content/collection', params: { id: collection.id } })
  }, [])

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

  return (
    <FlatList
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
      data={collections}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        showEmpty ? (
          <Text style={[styles.empty, { color: tokens.mutedForeground }]}>
            No collections available
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
          <ContentKindSwitch kind="videos" onChange={onKindChange} />
          {featured === null ? null : (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Featured</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openCollection(featured)}
                style={styles.featured}
              >
                <VideoThumbnail
                  frame="natural"
                  requestedId={featured.videoIds[0] ?? null}
                  showPlay
                  stacked
                />
                <Text style={[styles.cardTitle, { color: tokens.foreground }]}>
                  {featured.title}
                </Text>
                {featured.total === null ? null : (
                  <Text style={{ color: tokens.mutedForeground }}>
                    {videoCount(featured.total)}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
          {collections.length === 0 ? null : (
            <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>All collections</Text>
          )}
          {errorAtTop ? errorRow : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => openCollection(item)}
          style={styles.row}
        >
          <VideoThumbnail frame="row" requestedId={item.videoIds[0] ?? null} stacked />
          <View style={styles.rowText}>
            <Text style={[styles.cardTitle, { color: tokens.foreground }]}>{item.title}</Text>
            {item.total === null ? null : (
              <Text style={{ color: tokens.mutedForeground }}>{videoCount(item.total)}</Text>
            )}
          </View>
          <Text style={{ color: tokens.mutedForeground }}>›</Text>
        </Pressable>
      )}
      style={{ backgroundColor: tokens.background }}
    />
  )
}

function videoCount(total: number): string {
  if (total === 1) return '1 video'
  return `${total} videos`
}

const styles = StyleSheet.create({
  header: {
    gap: 16,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    paddingTop: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  featured: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontSize: 15,
  },
  errorRow: {
    gap: 8,
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

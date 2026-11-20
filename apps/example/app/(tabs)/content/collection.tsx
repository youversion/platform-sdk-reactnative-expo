import { usePlaylists, type ContentLibraryVideo } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { VideoThumbnail } from '../../../src/components/video-thumbnail'
import {
  openedCollection,
  rememberCollection,
  rememberPlaylistVideo,
} from '../../../src/lib/opened-videos'
import {
  collectionShareText,
  formatLanguageList,
  formatRuntime,
  languageName,
  listedCollection,
  playlistLanguageTags,
  playlistRuntimeSeconds,
  visibleText,
  type ListedCollection,
} from '../../../src/lib/playlist-videos'
import { shareMessage } from '../../../src/lib/share-image'
import { useContentLanguage } from '../../../src/lib/use-content-language'
import { BIBLE_PROJECT_ORGANIZATION_ID } from '../../../src/lib/use-content-playlists'
import { usePlaylistVideos } from '../../../src/lib/use-playlist-videos'

function openVideo(requestedId: string, video: ContentLibraryVideo, collectionTitle: string): void {
  rememberPlaylistVideo(requestedId, video)
  router.push({
    pathname: '/content/video',
    params: { id: requestedId, collection: collectionTitle },
  })
}

function routeId(value: string | string[] | undefined): string | null {
  if (value === undefined) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export default function ContentCollectionScreen() {
  const tokens = useTokens()
  const { bottom } = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = routeId(params.id)
  const language = useContentLanguage()
  const playlists = usePlaylists()
  const stored = id === null ? undefined : openedCollection(id)
  const [fetched, setFetched] = useState<ListedCollection | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const collection = stored ?? (fetched?.id === id ? fetched : null)

  useEffect(() => {
    setFetched(null)
    setFetchError(null)
    if (id === null) {
      setFetching(false)
      setFetchError('Collection unavailable')
      return
    }
    if (openedCollection(id) !== undefined) {
      setFetching(false)
      return
    }
    const playlistId = Number(id)
    if (!Number.isInteger(playlistId)) {
      setFetching(false)
      setFetchError('Collection unavailable')
      return
    }
    let alive = true
    setFetching(true)
    void playlists
      .get(BIBLE_PROJECT_ORGANIZATION_ID, playlistId, { accept_language: language })
      .then((result) => {
        if (!alive) return
        setFetching(false)
        if (!result.ok) {
          setFetchError(result.error.message)
          return
        }
        const listed = listedCollection(result.value)
        if (listed === null) {
          setFetchError('Collection unavailable')
          return
        }
        rememberCollection(listed)
        setFetched(listed)
      })
      .catch(() => {
        if (!alive) return
        setFetching(false)
        setFetchError('Collection unavailable')
      })
    return () => {
      alive = false
    }
  }, [id, language, playlists, reloadKey])

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      {fetching ? (
        <ActivityIndicator color={tokens.mutedForeground} style={styles.loading} />
      ) : null}
      {fetchError !== null && collection === null ? (
        <View style={styles.errorBlock}>
          <Text style={{ color: tokens.destructive }}>{fetchError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setReloadKey((key) => key + 1)}
            style={[styles.retry, { borderColor: tokens.border, borderRadius: tokens.radius.full }]}
          >
            <Text style={{ color: tokens.foreground }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {collection === null ? null : (
        <CollectionDetail bottom={bottom} collection={collection} key={collection.id} />
      )}
    </View>
  )
}

function CollectionDetail({
  collection,
  bottom,
}: {
  collection: ListedCollection
  bottom: number
}) {
  const tokens = useTokens()
  const library = usePlaylistVideos(collection.videoIds)
  const description = visibleText(collection.description)
  const loaded = new Map(library.videos.map((item) => [item.requestedId, item.video]))
  const runtime = playlistRuntimeSeconds(collection.videoIds, loaded)
  const languages = formatLanguageList(
    playlistLanguageTags(collection.videoIds, loaded).map((tag) => languageName(tag)),
  )
  const hero = library.videos[0]
  const heroId = hero?.requestedId ?? collection.videoIds[0] ?? null
  const shareText = collectionShareText(
    collection.title,
    library.videos.map((item) => item.video.share_url),
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            shareText === '' ? null : (
              <Pressable
                accessibilityLabel="Share collection"
                accessibilityRole="button"
                onPress={() => {
                  void shareMessage(shareText)
                }}
                style={styles.share}
              >
                <Text style={{ color: tokens.foreground }}>Share</Text>
              </Pressable>
            ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={hero === undefined}
          onPress={() => {
            if (hero === undefined) return
            openVideo(hero.requestedId, hero.video, collection.title)
          }}
        >
          <VideoThumbnail
            frame="natural"
            requestedId={heroId}
            showPlay={hero !== undefined}
            video={hero?.video ?? null}
          />
        </Pressable>
        <Text style={[styles.title, { color: tokens.foreground }]}>{collection.title}</Text>
        {description === null ? null : (
          <Text style={[styles.description, { color: tokens.mutedForeground }]}>{description}</Text>
        )}
        <View style={styles.metaRow}>
          {collection.total === null ? null : (
            <Metadata title="Videos" value={String(collection.total)} />
          )}
          {runtime === null ? null : (
            <Metadata title="Duration" value={formatRuntime(runtime, true)} />
          )}
          {languages === '' ? null : <Metadata title="Language" value={languages} />}
        </View>
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Videos</Text>
        {library.loading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {library.error === null ? null : (
          <View style={styles.errorBlock}>
            <Text style={{ color: tokens.destructive }}>{library.error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={library.retry}
              style={[
                styles.retry,
                { borderColor: tokens.border, borderRadius: tokens.radius.full },
              ]}
            >
              <Text style={{ color: tokens.foreground }}>Retry</Text>
            </Pressable>
          </View>
        )}
        {collection.videoIds.length === 0 && !library.loading ? (
          <Text style={{ color: tokens.mutedForeground }}>No videos in this collection</Text>
        ) : null}
        {library.videos.map((item, index) => (
          <Pressable
            accessibilityRole="button"
            key={`${item.requestedId}-${index}`}
            onPress={() => openVideo(item.requestedId, item.video, collection.title)}
            style={styles.videoRow}
          >
            <VideoThumbnail frame="row" requestedId={item.requestedId} video={item.video} />
            <Text style={[styles.videoTitle, { color: tokens.foreground }]}>
              {visibleText(item.video.title) ?? 'Video'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  )
}

function Metadata({ title, value }: { title: string; value: string }) {
  const tokens = useTokens()
  return (
    <View
      style={[styles.meta, { backgroundColor: tokens.muted, borderRadius: tokens.radius.surface }]}
    >
      <Text style={[styles.metaLabel, { color: tokens.mutedForeground }]}>{title}</Text>
      <Text style={[styles.metaValue, { color: tokens.foreground }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loading: {
    marginTop: 24,
  },
  content: {
    gap: 16,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  meta: {
    flex: 1,
    gap: 4,
    padding: 10,
  },
  metaLabel: {
    fontSize: 12,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  videoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  videoTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  errorBlock: {
    gap: 8,
    padding: 20,
  },
  retry: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  share: {
    paddingHorizontal: 8,
  },
})

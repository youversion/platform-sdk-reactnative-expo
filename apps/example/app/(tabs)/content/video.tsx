import { useVideos, type ContentLibraryVideo } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LibraryVideoPlayer } from '../../../src/components/library-video-player'
import { openedPlaylistVideo } from '../../../src/lib/opened-videos'
import {
  formatRuntime,
  playbackSourceUrl,
  videoDisplayAspect,
  visibleText,
} from '../../../src/lib/playlist-videos'
import { sampleVideo } from '../../../src/lib/sample-video-library'
import { shareImageUrl } from '../../../src/lib/share-image'
import { useContentLanguage } from '../../../src/lib/use-content-language'

function routeId(value: string | string[] | undefined): string | null {
  if (value === undefined) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export default function ContentVideoScreen() {
  const tokens = useTokens()
  const { bottom } = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    id?: string | string[]
    collection?: string | string[]
  }>()
  const id = routeId(params.id)
  const collectionTitle = visibleText(routeId(params.collection))
  const language = useContentLanguage()
  const videos = useVideos()
  const stored = id === null ? undefined : openedPlaylistVideo(id)
  const local = id === null ? null : sampleVideo(id)
  const [fetched, setFetched] = useState<ContentLibraryVideo | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    setFetched(null)
    setFetchError(null)
    if (id === null) {
      setFetching(false)
      setFetchError('Video unavailable')
      return
    }
    if (openedPlaylistVideo(id) !== undefined || sampleVideo(id) !== null) {
      setFetching(false)
      return
    }
    let alive = true
    setFetching(true)
    void videos
      .get(id, { acceptLanguage: language, thumbnailSize: 'card' })
      .then((result) => {
        if (!alive) return
        setFetching(false)
        if (result.ok) {
          setFetched(result.value)
          return
        }
        setFetchError(result.error.message)
      })
      .catch(() => {
        if (!alive) return
        setFetching(false)
        setFetchError('Video unavailable')
      })
    return () => {
      alive = false
    }
  }, [id, language, reloadKey, videos])

  const current = stored ?? local ?? fetched
  const playbackUrl = current === null ? null : playbackSourceUrl(current.playback_sources)
  const title = current === null ? null : visibleText(current.title)
  const description = current === null ? null : visibleText(current.description)
  let runtime = ''
  if (current !== null && current.runtime !== null && current.runtime !== undefined) {
    runtime = formatRuntime(current.runtime, false)
  }
  const shareUrl = current?.share_url ?? null
  const canShare = shareUrl !== null && shareUrl.trim() !== ''
  let subtitle = ''
  if (collectionTitle !== null && runtime !== '') subtitle = `${collectionTitle} · ${runtime}`
  else if (collectionTitle !== null) subtitle = collectionTitle
  else subtitle = runtime

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <Stack.Screen
        options={{
          headerRight: () =>
            canShare ? (
              <Pressable
                accessibilityLabel="Share video"
                accessibilityRole="button"
                onPress={() => {
                  if (shareUrl === null) return
                  void shareImageUrl(shareUrl)
                }}
                style={styles.share}
              >
                <Text style={{ color: tokens.foreground }}>Share</Text>
              </Pressable>
            ) : null,
        }}
      />
      {/* Player sits outside the ScrollView so AVKit mute/volume pans are not stolen. */}
      {current !== null ? (
        <View style={styles.playerSlot}>
          {playbackUrl === null ? (
            <View
              style={[
                styles.unavailable,
                {
                  aspectRatio: videoDisplayAspect(current.thumbnail, current.orientation),
                  backgroundColor: tokens.muted,
                  borderRadius: 8,
                },
              ]}
            >
              <Text style={[styles.unavailableTitle, { color: tokens.foreground }]}>
                Video unavailable
              </Text>
            </View>
          ) : (
            <LibraryVideoPlayer
              aspect={videoDisplayAspect(current.thumbnail, current.orientation)}
              url={playbackUrl}
            />
          )}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}>
        {fetching ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {fetchError !== null && current === null ? (
          <View style={styles.errorBlock}>
            <Text style={{ color: tokens.destructive }}>{fetchError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReloadKey((key) => key + 1)}
              style={[
                styles.retry,
                { borderColor: tokens.border, borderRadius: tokens.radius.full },
              ]}
            >
              <Text style={{ color: tokens.foreground }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {current === null ? null : (
          <>
            {title === null ? null : (
              <Text style={[styles.title, { color: tokens.foreground }]}>{title}</Text>
            )}
            {subtitle === '' ? null : (
              <Text style={{ color: tokens.mutedForeground }}>{subtitle}</Text>
            )}
            {description === null ? null : (
              <Text style={[styles.description, { color: tokens.foreground }]}>{description}</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  playerSlot: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    fontSize: 16,
  },
  unavailable: {
    justifyContent: 'center',
    padding: 16,
    width: '100%',
  },
  unavailableTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  errorBlock: {
    gap: 8,
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

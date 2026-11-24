import { useEffect, useState, type ReactNode } from 'react'
import { useVideos, type ContentLibraryVideo } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { formatRuntime, videoDisplayAspect } from '../lib/playlist-videos'
import { sampleVideo } from '../lib/sample-video-library'
import { useContentLanguage } from '../lib/use-content-language'

type VideoThumbnailProps = {
  requestedId: string | null
  video?: ContentLibraryVideo | null
  frame: 'natural' | 'row'
  showPlay?: boolean
  stacked?: boolean
}

export function VideoThumbnail({
  requestedId,
  video,
  frame,
  showPlay = false,
  stacked = false,
}: VideoThumbnailProps) {
  const tokens = useTokens()
  const videos = useVideos()
  const language = useContentLanguage()
  const [loaded, setLoaded] = useState<ContentLibraryVideo | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const [imageAttempt, setImageAttempt] = useState(0)
  const local = requestedId === null ? null : sampleVideo(requestedId)
  const provided = video ?? local
  const shown = provided ?? loaded
  const aspect = videoDisplayAspect(shown?.thumbnail, shown?.orientation)

  useEffect(() => {
    if (provided !== null || requestedId === null) return
    let alive = true
    setFailure(null)
    setLoaded(null)
    void videos
      .get(requestedId, { acceptLanguage: language, thumbnailSize: 'card' })
      .then((result) => {
        if (!alive) return
        if (result.ok) {
          setLoaded(result.value)
          return
        }
        setFailure(result.error.message)
      })
    return () => {
      alive = false
    }
  }, [attempt, language, provided, requestedId, videos])

  const uri = shown?.thumbnail?.url ?? null
  const [trackedUri, setTrackedUri] = useState(uri)
  if (trackedUri !== uri) {
    setTrackedUri(uri)
    setImageFailed(false)
  }
  const runtime = shown?.runtime
  const duration = runtime === null || runtime === undefined ? '' : formatRuntime(runtime, false)
  const waiting = failure === null && provided === null && requestedId !== null && loaded === null
  let placeholder: ReactNode = <Text style={{ color: tokens.mutedForeground }}>▶</Text>
  if (waiting) placeholder = <ActivityIndicator color={tokens.mutedForeground} />
  // The Retry overlay fills the frame; a centered ▶ under it collides with the label.
  if (failure !== null || imageFailed) placeholder = null

  return (
    <View style={stacked ? styles.stack : null}>
      {stacked ? (
        <>
          <View
            style={[
              styles.back,
              styles.backFar,
              { backgroundColor: tokens.border, borderRadius: tokens.radius.surface },
            ]}
          />
          <View
            style={[
              styles.back,
              styles.backNear,
              { backgroundColor: tokens.muted, borderRadius: tokens.radius.surface },
            ]}
          />
        </>
      ) : null}
      <View
        style={[
          frame === 'row' ? styles.row : styles.natural,
          {
            aspectRatio: frame === 'row' ? undefined : aspect,
            backgroundColor: tokens.muted,
            borderRadius: tokens.radius.surface,
          },
        ]}
      >
        {uri !== null && !imageFailed ? (
          <Image
            accessibilityIgnoresInvertColors
            key={`${uri}-${imageAttempt}`}
            onError={() => setImageFailed(true)}
            resizeMode="cover"
            source={{ uri }}
            style={styles.fill}
          />
        ) : (
          <View style={styles.fill}>{placeholder}</View>
        )}
        {showPlay && uri !== null && !imageFailed ? (
          <View style={[styles.play, { backgroundColor: tokens.foreground }]}>
            <Text style={{ color: tokens.background }}>▶</Text>
          </View>
        ) : null}
        {duration === '' ? null : (
          <View style={[styles.duration, { backgroundColor: tokens.foreground }]}>
            <Text style={[styles.durationText, { color: tokens.background }]}>{duration}</Text>
          </View>
        )}
        {failure === null ? null : (
          <Pressable
            accessibilityHint={failure}
            accessibilityLabel="Retry loading thumbnail"
            accessibilityRole="button"
            onPress={() => {
              setImageFailed(false)
              setAttempt((value) => value + 1)
            }}
            style={styles.retry}
          >
            <Text style={{ color: tokens.foreground }}>Retry</Text>
          </Pressable>
        )}
        {imageFailed && failure === null ? (
          <Pressable
            accessibilityLabel="Retry loading thumbnail"
            accessibilityRole="button"
            onPress={() => {
              setImageFailed(false)
              setImageAttempt((value) => value + 1)
            }}
            style={styles.retry}
          >
            <Text style={{ color: tokens.foreground }}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: {
    paddingTop: 10,
  },
  back: {
    height: 12,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  backFar: {
    marginHorizontal: 18,
    top: 0,
  },
  backNear: {
    marginHorizontal: 10,
    top: 5,
  },
  natural: {
    overflow: 'hidden',
    width: '100%',
  },
  row: {
    height: 64,
    overflow: 'hidden',
    width: 112,
  },
  fill: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  play: {
    borderRadius: 18,
    bottom: 12,
    height: 36,
    justifyContent: 'center',
    left: 12,
    position: 'absolute',
    width: 36,
    alignItems: 'center',
  },
  duration: {
    borderRadius: 999,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: 'absolute',
    right: 8,
  },
  durationText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  retry: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})

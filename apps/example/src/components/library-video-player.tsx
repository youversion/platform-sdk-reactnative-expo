import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { useFocusEffect } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

type LibraryVideoPlayerProps = {
  url: string
  aspect: number
}

/**
 * Plays `playback_sources` only. Preview clips are a different asset, and a
 * preview failure must not replace a video that can still play.
 */
export function LibraryVideoPlayer({ url, aspect }: LibraryVideoPlayerProps) {
  const tokens = useTokens()
  const player = useVideoPlayer(url, (created) => {
    created.loop = false
  })
  const [status, setStatus] = useState(player.status)
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  useEffect(() => {
    const subscription = player.addListener('statusChange', (payload) => {
      setStatus(payload.status)
      if (payload.status === 'error') {
        setPlaybackError(payload.error?.message ?? 'Video unavailable')
        return
      }
      setPlaybackError(null)
    })
    return () => {
      subscription.remove()
    }
  }, [player])

  useFocusEffect(
    useCallback(() => {
      return () => {
        player.pause()
      }
    }, [player]),
  )

  function retry() {
    setPlaybackError(null)
    void player.replaceAsync(url).then(
      () => {
        player.play()
      },
      () => {
        setPlaybackError('Video unavailable')
      },
    )
  }

  if (playbackError !== null) {
    return (
      <View
        style={[
          styles.unavailable,
          {
            aspectRatio: aspect,
            backgroundColor: tokens.muted,
            borderRadius: tokens.radius.surface,
          },
        ]}
      >
        <Text style={[styles.unavailableTitle, { color: tokens.foreground }]}>
          Video unavailable
        </Text>
        <Text style={{ color: tokens.mutedForeground }}>{playbackError}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={[styles.retry, { borderColor: tokens.border, borderRadius: tokens.radius.full }]}
        >
          <Text style={{ color: tokens.foreground }}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <VideoView
        accessibilityLabel="Video player"
        contentFit="contain"
        nativeControls
        player={player}
        style={[
          styles.player,
          {
            aspectRatio: aspect,
            backgroundColor: tokens.muted,
            borderRadius: tokens.radius.surface,
          },
        ]}
      />
      {status === 'loading' || status === 'idle' ? (
        <ActivityIndicator color={tokens.mutedForeground} style={styles.loading} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  player: {
    overflow: 'hidden',
    width: '100%',
  },
  unavailable: {
    alignItems: 'flex-start',
    gap: 8,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 16,
    width: '100%',
  },
  unavailableTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  retry: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loading: {
    marginTop: 8,
  },
})

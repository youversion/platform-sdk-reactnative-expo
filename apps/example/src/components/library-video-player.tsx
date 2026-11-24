import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { useFocusEffect } from 'expo-router'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

import { formatRuntime } from '../lib/playlist-videos'
import { ExpandGlyph, PauseGlyph, PlayGlyph } from './playback-control-icons'

type LibraryVideoPlayerProps = {
  url: string
  aspect: number
}

const OVERLAY_INSET = 8
const PLAY_SIZE = 32
const METER_HEIGHT = 6
const FRAME_RADIUS = 8
const CONTROL_SCRIM = 'rgba(0, 0, 0, 0.75)'
const METER_TRACK = 'rgba(237, 235, 235, 0.6)'

/**
 * Landscape fullscreen locks the interface sideways. Dismissing with the device
 * already upright can leave the window stuck in landscape — nudge portrait, then
 * unlock so free rotation works again.
 */
async function releaseFullscreenOrientation(): Promise<void> {
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
    await ScreenOrientation.unlockAsync()
  } catch {
    // Locks can fail on web or if the native module is not in this binary yet.
  }
}

/**
 * Plays `playback_sources` only. Preview clips are a different asset, and a
 * preview failure must not replace a video that can still play.
 *
 * Inline: Figma overlay (AVKit chrome is unreliable on this iOS sim). Fullscreen:
 * expo-video forces system controls even when `nativeControls` is false.
 */
export function LibraryVideoPlayer({ url, aspect }: LibraryVideoPlayerProps) {
  const tokens = useTokens()
  const player = useVideoPlayer(url, (created) => {
    created.loop = false
    created.muted = false
    created.volume = 1
    created.audioMixingMode = 'auto'
    created.timeUpdateEventInterval = 0.25
  })
  const [status, setStatus] = useState(player.status)
  const [playing, setPlaying] = useState(player.playing)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const viewRef = useRef<VideoView>(null)
  const focused = useRef(false)
  const dismissedWhileLandscape = useRef(false)
  const scrubbing = useRef(false)
  const [scrubTime, setScrubTime] = useState<number | null>(null)
  const trackWidth = useRef(0)
  const durationRef = useRef(0)
  const playerRef = useRef(player)
  durationRef.current = duration
  playerRef.current = player
  const { width, height } = useWindowDimensions()
  const landscape = width > height

  useEffect(() => {
    const statusSub = player.addListener('statusChange', (payload) => {
      setStatus(payload.status)
      if (payload.status === 'error') {
        setPlaybackError(payload.error?.message ?? 'Video unavailable')
        return
      }
      setPlaybackError(null)
    })
    const playingSub = player.addListener('playingChange', (payload) => {
      setPlaying(payload.isPlaying)
    })
    const timeSub = player.addListener('timeUpdate', (payload) => {
      if (!scrubbing.current) setCurrentTime(payload.currentTime)
      if (player.duration > 0) setDuration(player.duration)
    })
    const loadSub = player.addListener('sourceLoad', (payload) => {
      if (payload.duration > 0) setDuration(payload.duration)
    })
    return () => {
      statusSub.remove()
      playingSub.remove()
      timeSub.remove()
      loadSub.remove()
    }
  }, [player])

  useFocusEffect(
    useCallback(() => {
      focused.current = true
      return () => {
        focused.current = false
        try {
          player.pause()
        } catch {}
      }
    }, [player]),
  )

  useEffect(() => {
    if (!focused.current) return
    const view = viewRef.current
    if (view === null) return
    if (landscape) {
      if (dismissedWhileLandscape.current) return
      void view.enterFullscreen().catch(() => {})
      return
    }
    dismissedWhileLandscape.current = false
    void view.exitFullscreen().catch(() => {})
  }, [landscape])

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

  function togglePlay() {
    if (playing) {
      player.pause()
      return
    }
    player.play()
  }

  function expandFullscreen() {
    const view = viewRef.current
    if (view === null || fullscreen) return
    dismissedWhileLandscape.current = false
    setFullscreen(true)
    void view.enterFullscreen().catch(() => {
      setFullscreen(false)
    })
  }

  const timeAtX = useCallback((x: number): number => {
    const total = durationRef.current
    if (!(total > 0) || trackWidth.current <= 0) return 0
    const ratio = Math.min(Math.max(x / trackWidth.current, 0), 1)
    return ratio * total
  }, [])

  const beginScrub = useCallback(
    (x: number) => {
      scrubbing.current = true
      setScrubTime(timeAtX(x))
    },
    [timeAtX],
  )

  const moveScrub = useCallback(
    (x: number) => {
      setScrubTime(timeAtX(x))
    },
    [timeAtX],
  )

  const endScrub = useCallback(
    (x: number) => {
      const next = timeAtX(x)
      if (durationRef.current > 0) {
        playerRef.current.currentTime = next
        setCurrentTime(next)
      }
      scrubbing.current = false
      setScrubTime(null)
    },
    [timeAtX],
  )

  const cancelScrub = useCallback(() => {
    if (!scrubbing.current) return
    scrubbing.current = false
    setScrubTime(null)
  }, [])

  const scrubGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onBegin((event) => {
      runOnJS(beginScrub)(event.x)
    })
    .onUpdate((event) => {
      runOnJS(moveScrub)(event.x)
    })
    .onEnd((event) => {
      runOnJS(endScrub)(event.x)
    })
    .onFinalize((_event, success) => {
      if (success) return
      runOnJS(cancelScrub)()
    })

  const tapSeek = Gesture.Tap().onEnd((event) => {
    runOnJS(endScrub)(event.x)
  })

  const displayTime = scrubTime ?? currentTime
  const progress = duration > 0 ? Math.min(Math.max(displayTime / duration, 0), 1) : 0
  const durationLabel = formatRuntime(duration, duration >= 3600) || '0:00'

  if (playbackError !== null) {
    return (
      <View
        style={[
          styles.unavailable,
          {
            aspectRatio: aspect,
            backgroundColor: tokens.muted,
            borderRadius: FRAME_RADIUS,
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
    <View style={[styles.root, { aspectRatio: aspect, borderRadius: FRAME_RADIUS }]}>
      <VideoView
        accessibilityLabel="Video player"
        contentFit="contain"
        fullscreenOptions={{ enable: true, orientation: 'landscape' }}
        nativeControls={false}
        onFullscreenEnter={() => {
          dismissedWhileLandscape.current = false
          setFullscreen(true)
        }}
        onFullscreenExit={() => {
          dismissedWhileLandscape.current = true
          setFullscreen(false)
          void releaseFullscreenOrientation()
        }}
        player={player}
        ref={viewRef}
        style={[styles.player, { backgroundColor: tokens.muted }]}
      />
      {fullscreen ? null : (
        <View pointerEvents="box-none" style={styles.overlay}>
          <View style={styles.chrome}>
            <View style={styles.row}>
              <Pressable
                accessibilityLabel={playing ? 'Pause' : 'Play'}
                accessibilityRole="button"
                hitSlop={8}
                onPress={togglePlay}
                style={styles.playButton}
              >
                {playing ? <PauseGlyph /> : <PlayGlyph />}
              </Pressable>
              <View style={styles.rowSpacer} />
              <View style={styles.trailing}>
                <View style={styles.durationPill}>
                  <Text style={styles.durationText}>{durationLabel}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Full screen"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={expandFullscreen}
                  style={styles.playButton}
                >
                  <ExpandGlyph />
                </Pressable>
              </View>
            </View>
            <GestureDetector gesture={Gesture.Exclusive(scrubGesture, tapSeek)}>
              <View
                accessibilityLabel="Seek"
                accessibilityRole="adjustable"
                accessibilityValue={{
                  min: 0,
                  max: Math.max(Math.floor(duration), 0),
                  now: Math.floor(displayTime),
                }}
                onLayout={(event) => {
                  trackWidth.current = event.nativeEvent.layout.width
                }}
                style={styles.meterHit}
              >
                <View style={[styles.meterTrack, { backgroundColor: METER_TRACK }]}>
                  <View
                    style={[
                      styles.meterFill,
                      {
                        backgroundColor: tokens.destructive,
                        width: `${progress * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </GestureDetector>
          </View>
        </View>
      )}
      {status === 'loading' || status === 'idle' ? (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={tokens.mutedForeground} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    width: '100%',
  },
  player: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: OVERLAY_INSET,
  },
  chrome: {
    gap: OVERLAY_INSET,
    width: '100%',
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    width: '100%',
  },
  rowSpacer: {
    flex: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: CONTROL_SCRIM,
    borderRadius: PLAY_SIZE / 2,
    height: PLAY_SIZE,
    justifyContent: 'center',
    width: PLAY_SIZE,
  },
  durationPill: {
    alignItems: 'center',
    backgroundColor: CONTROL_SCRIM,
    borderRadius: 40,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12.8,
  },
  meterHit: {
    height: 20,
    justifyContent: 'center',
    width: '100%',
  },
  meterTrack: {
    borderRadius: METER_HEIGHT / 2,
    height: METER_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  meterFill: {
    borderRadius: METER_HEIGHT / 2,
    height: '100%',
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
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

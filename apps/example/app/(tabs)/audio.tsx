import { setAudioModeAsync, useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SKIP_SECONDS = 15

const TRACKS = [
  {
    title: 'Sample 1',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    title: 'Sample 2',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    title: 'Sample 3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
] as const

const PLAYLIST = {
  sources: TRACKS.map((track) => ({ uri: track.uri, name: track.title })),
  updateInterval: 250,
  loop: 'none',
} as const

export default function AudioScreen() {
  const { top, bottom } = useSafeAreaInsets()
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = colorTheme[scheme]
  const playlist = useAudioPlaylist(PLAYLIST)
  const status = useAudioPlaylistStatus(playlist)
  const [scrubTime, setScrubTime] = useState<number | null>(null)

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    })
  }, [])

  const track = TRACKS[status.currentIndex]
  const title = track ? track.title : 'Audio'
  const shownTime = scrubTime === null ? status.currentTime : scrubTime
  const atLastTrack = status.currentIndex >= TRACKS.length - 1
  const atFirstMoment = status.currentIndex <= 0 && status.currentTime <= 3

  function togglePlayback() {
    if (status.playing) {
      playlist.pause()
      return
    }
    playlist.play()
  }

  function stop() {
    playlist.pause()
    void playlist.seekTo(0)
  }

  function skipBy(delta: number) {
    const next = clamp(status.currentTime + delta, 0, status.duration)
    void playlist.seekTo(next)
  }

  function goToPreviousTrack() {
    if (status.currentTime > 3) {
      void playlist.seekTo(0)
      return
    }
    playlist.previous()
  }

  function playTrack(index: number) {
    playlist.skipTo(index)
    playlist.play()
  }

  let statusLine = `Track ${status.currentIndex + 1} of ${TRACKS.length}`
  if (!status.isLoaded) {
    statusLine = 'Getting the audio ready…'
  } else if (status.isBuffering) {
    statusLine = 'Buffering…'
  }

  let playLabel = 'Play'
  if (status.playing) {
    playLabel = 'Pause'
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.content, { paddingTop: top + 24, paddingBottom: bottom + 32 }]}
    >
      <Text style={[styles.heading, { color: theme.fg }]}>Audio</Text>
      <Text style={[styles.lede, { color: theme.muted }]}>
        A small player for this sample app. It streams three public MP3s with expo-audio.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
        <Text style={[styles.title, { color: theme.fg }]}>{title}</Text>
        <Text style={[styles.status, { color: theme.muted }]}>{statusLine}</Text>

        <View style={styles.times}>
          <Text style={[styles.time, { color: theme.fg }]}>{formatTime(shownTime)}</Text>
          <Text style={[styles.time, { color: theme.muted }]}>{formatTime(status.duration)}</Text>
        </View>

        <Scrubber
          position={shownTime}
          duration={status.duration}
          fill={theme.fg}
          track={theme.line}
          onPreview={setScrubTime}
          onSeek={(seconds) => {
            void playlist.seekTo(seconds)
          }}
        />

        <View style={styles.transport}>
          <Control
            label="Previous"
            disabled={atFirstMoment}
            onPress={goToPreviousTrack}
            theme={theme}
          />
          <Control label={playLabel} prominent onPress={togglePlayback} theme={theme} />
          <Control
            label="Next"
            disabled={atLastTrack}
            onPress={() => playlist.next()}
            theme={theme}
          />
        </View>
        <View style={styles.transport}>
          <Control label="Back 15s" onPress={() => skipBy(-SKIP_SECONDS)} theme={theme} />
          <Control label="Stop" onPress={stop} theme={theme} />
          <Control label="Forward 15s" onPress={() => skipBy(SKIP_SECONDS)} theme={theme} />
        </View>
      </View>

      <Text style={[styles.section, { color: theme.fg }]}>Tracks</Text>
      {TRACKS.map((item, index) => {
        const selected = index === status.currentIndex
        let rowLabel = 'Play'
        if (selected && status.playing) {
          rowLabel = 'Playing'
        }
        return (
          <Pressable
            key={item.uri}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => playTrack(index)}
            style={[styles.row, { borderColor: theme.line, backgroundColor: theme.card }]}
          >
            <Text style={[styles.rowTitle, { color: theme.fg }]}>{item.title}</Text>
            <Text style={[styles.rowMeta, { color: theme.muted }]}>{rowLabel}</Text>
          </Pressable>
        )
      })}

      <Text style={[styles.note, { color: theme.muted }]}>
        Rebuild the dev client once after pulling this in. An older build does not include the audio
        package, so this tab will stay quiet until then.
      </Text>
    </ScrollView>
  )
}

function Scrubber({
  position,
  duration,
  fill,
  track,
  onPreview,
  onSeek,
}: {
  position: number
  duration: number
  fill: string
  track: string
  onPreview: (seconds: number | null) => void
  onSeek: (seconds: number) => void
}) {
  const width = useRef(0)
  const [dragSeconds, setDragSeconds] = useState<number | null>(null)

  function secondsFor(x: number): number {
    if (width.current <= 0 || duration <= 0) return 0
    const ratio = clamp(x / width.current, 0, 1)
    return ratio * duration
  }

  let shown = position
  if (dragSeconds !== null) {
    shown = dragSeconds
  }
  let ratio = 0
  if (duration > 0) {
    ratio = clamp(shown / duration, 0, 1)
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      style={styles.scrubHit}
      onLayout={(event) => {
        width.current = event.nativeEvent.layout.width
      }}
      onStartShouldSetResponder={() => duration > 0}
      onMoveShouldSetResponder={() => duration > 0}
      onResponderGrant={(event) => {
        const seconds = secondsFor(event.nativeEvent.locationX)
        setDragSeconds(seconds)
        onPreview(seconds)
      }}
      onResponderMove={(event) => {
        const seconds = secondsFor(event.nativeEvent.locationX)
        setDragSeconds(seconds)
        onPreview(seconds)
      }}
      onResponderRelease={(event) => {
        const seconds = secondsFor(event.nativeEvent.locationX)
        setDragSeconds(null)
        onPreview(null)
        onSeek(seconds)
      }}
      onResponderTerminate={() => {
        setDragSeconds(null)
        onPreview(null)
      }}
    >
      <View style={[styles.scrubTrack, { backgroundColor: track }]}>
        <View style={[styles.scrubFill, { backgroundColor: fill, width: `${ratio * 100}%` }]} />
      </View>
      <View style={[styles.scrubThumb, { backgroundColor: fill, left: `${ratio * 100}%` }]} />
    </View>
  )
}

function Control({
  label,
  onPress,
  theme,
  disabled = false,
  prominent = false,
}: {
  label: string
  onPress: () => void
  theme: (typeof colorTheme)[keyof typeof colorTheme]
  disabled?: boolean
  prominent?: boolean
}) {
  const background = prominent ? theme.fg : theme.card
  const color = prominent ? theme.bg : theme.fg
  const borderColor = prominent ? theme.fg : theme.line

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.control,
        { backgroundColor: background, borderColor, opacity: disabled ? 0.35 : 1 },
      ]}
    >
      <Text style={[styles.controlLabel, { color }]}>{label}</Text>
    </Pressable>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remain = total % 60
  let padded = String(remain)
  if (remain < 10) {
    padded = `0${remain}`
  }
  return `${minutes}:${padded}`
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

const colorTheme = {
  light: {
    bg: '#ffffff',
    fg: '#000000',
    muted: '#6b6b6b',
    card: '#f6f6f6',
    line: '#e4e4e4',
  },
  dark: {
    bg: '#000000',
    fg: '#ffffff',
    muted: '#9b9b9b',
    card: '#1c1c1e',
    line: '#2c2c2e',
  },
} as const

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 12,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
  },
  lede: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  status: {
    fontSize: 15,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  scrubHit: {
    height: 32,
    justifyContent: 'center',
  },
  scrubTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scrubFill: {
    height: 6,
  },
  scrubThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  transport: {
    flexDirection: 'row',
    gap: 8,
  },
  control: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  controlLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  row: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 16,
  },
  rowMeta: {
    fontSize: 14,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
})

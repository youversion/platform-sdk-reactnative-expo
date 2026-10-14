import { BibleReader, useTokens } from '@youversion/platform-react-native-expo-ui'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import {
  AUDIO_CHAPTERS,
  OPENING_CHAPTER_INDEX,
  SKIP_SECONDS,
  chapterAt,
  clampSeconds,
  collapseDrawer,
  drawerIsOpen,
  formatClock,
  formatRate,
  formatRemaining,
  formatSleep,
  loadPhaseAfterWait,
  nextChapterIndex,
  nextPlaybackRate,
  nextSleepMinutes,
  pressToolbar,
  sleepDeadline,
  sleepShouldPause,
  toolbarIcon,
  verseAtTime,
  type AudioChapter,
  type Chrome,
  type LoadPhase,
  type PlaybackRate,
  type SleepMinutes,
} from '../../src/audio/session'
import { ChromeFrame } from '../../src/audio/chrome-frame'

const STATUS_TICK_MS = 200
const READER_VERSION_ID = 3034

type Clock = {
  currentTime: number
  duration: number
}

const ReaderPane = memo(function ReaderPane({ book, chapter }: { book: string; chapter: string }) {
  return (
    <BibleReader
      showToolbar={false}
      book={book}
      chapter={chapter}
      versionId={READER_VERSION_ID}
    />
  )
})

export default function AudioScreen() {
  const tokens = useTokens()
  const { height: windowHeight } = useWindowDimensions()
  const [chapterIndex, setChapterIndex] = useState(OPENING_CHAPTER_INDEX)
  const [chrome, setChrome] = useState<Chrome>({ kind: 'idle' })
  const [loadPhase, setLoadPhase] = useState<LoadPhase>({ kind: 'loading' })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [rate, setRate] = useState<PlaybackRate>(1)
  const [sleepMinutes, setSleepMinutes] = useState<SleepMinutes | null>(null)
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null)
  const [clock, setClock] = useState<Clock>({ currentTime: 0, duration: 0 })
  const [previewTime, setPreviewTime] = useState<number | null>(null)
  const [heldTime, setHeldTime] = useState<number | null>(null)

  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null)
  const loadedRef = useRef(false)
  const failedRef = useRef(false)
  const rateRef = useRef(rate)
  const chromeRef = useRef(chrome)
  const heldTarget = useRef<number | null>(null)
  const seekGeneration = useRef(0)
  rateRef.current = rate
  chromeRef.current = chrome

  const chapter = chapterAt(chapterIndex)

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: false,
    })
  }, [])

  useEffect(() => {
    let alive = true
    const source = chapterAt(OPENING_CHAPTER_INDEX)
    const player = createAudioPlayer({ uri: source.uri }, { updateInterval: STATUS_TICK_MS })
    playerRef.current = player
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!alive) return
      loadedRef.current = status.isLoaded
      failedRef.current = status.error !== null
      setClock({ currentTime: status.currentTime, duration: status.duration })
      if (status.isLoaded || failedRef.current) {
        setLoadPhase((phase) =>
          loadPhaseAfterWait(phase, status.isLoaded, 0, failedRef.current),
        )
      }
      if (status.didJustFinish || failedRef.current) {
        setChrome((current) => {
          if (current.kind !== 'session') return current
          if (current.transport === 'paused') return current
          return { kind: 'session', drawer: current.drawer, transport: 'paused' }
        })
      }
    })
    return () => {
      alive = false
      subscription.remove()
      player.remove()
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => {
      setLoadPhase((phase) =>
        loadPhaseAfterWait(phase, loadedRef.current, Date.now() - started, failedRef.current),
      )
    }, 400)
    return () => clearInterval(id)
  }, [chapterIndex, loadAttempt])

  useEffect(() => {
    const target = heldTarget.current
    if (target === null) return
    if (Math.abs(clock.currentTime - target) > 0.5) return
    heldTarget.current = null
    setHeldTime(null)
  }, [clock.currentTime])

  useEffect(() => {
    return () => {
      seekGeneration.current += 1
    }
  }, [])

  useEffect(() => {
    if (sleepEndsAt === null) return
    const id = setInterval(() => {
      if (!sleepShouldPause(Date.now(), sleepEndsAt)) return
      playerRef.current?.pause()
      setChrome((current) => {
        if (current.kind !== 'session') return current
        return { kind: 'session', drawer: current.drawer, transport: 'paused' }
      })
      setSleepMinutes(null)
      setSleepEndsAt(null)
    }, 1000)
    return () => clearInterval(id)
  }, [sleepEndsAt])

  let shownTime = clock.currentTime
  if (heldTime !== null) shownTime = heldTime
  if (previewTime !== null) shownTime = previewTime

  function applyTransport(next: Chrome) {
    const player = playerRef.current
    if (!player) return
    if (next.kind === 'session' && next.transport === 'playing') {
      player.play()
      return
    }
    player.pause()
  }

  function onToolbarPress() {
    const next = pressToolbar(chrome)
    setChrome(next)
    applyTransport(next)
  }

  function onCollapse() {
    setChrome((current) => collapseDrawer(current))
  }

  function onSeek(seconds: number) {
    const next = clampSeconds(seconds, clock.duration)
    const generation = seekGeneration.current + 1
    seekGeneration.current = generation
    heldTarget.current = next
    setPreviewTime(null)
    setHeldTime(next)
    const player = playerRef.current
    if (!player) return
    void player.seekTo(next)
    setTimeout(() => {
      if (seekGeneration.current !== generation) return
      heldTarget.current = null
      setHeldTime(null)
    }, 1000)
  }

  function loadChapter(index: number) {
    const nextChapter = chapterAt(index)
    loadedRef.current = false
    failedRef.current = false
    setLoadPhase({ kind: 'loading' })
    setClock({ currentTime: 0, duration: 0 })
    setPreviewTime(null)
    setHeldTime(null)
    heldTarget.current = null
    const player = playerRef.current
    if (!player) return
    player.replace({ uri: nextChapter.uri })
    player.setPlaybackRate(rateRef.current)
    const currentChrome = chromeRef.current
    if (currentChrome.kind === 'session' && currentChrome.transport === 'playing') {
      player.play()
    }
  }

  function onChapterStep(direction: -1 | 1) {
    const next = nextChapterIndex(chapterIndex, AUDIO_CHAPTERS.length, direction)
    if (next === chapterIndex) return
    setChapterIndex(next)
    loadChapter(next)
  }

  function onRetry() {
    setLoadAttempt((attempt) => attempt + 1)
    loadChapter(chapterIndex)
  }

  function onSpeed() {
    const next = nextPlaybackRate(rate)
    setRate(next)
    playerRef.current?.setPlaybackRate(next)
  }

  function onSleep() {
    const next = nextSleepMinutes(sleepMinutes)
    setSleepMinutes(next)
    if (next === null) {
      setSleepEndsAt(null)
      return
    }
    setSleepEndsAt(sleepDeadline(Date.now(), next))
  }

  const open = drawerIsOpen(chrome)
  const icon = toolbarIcon(chrome)
  const verse = verseAtTime(chapter.mockVerseTimings, shownTime)
  const sans = tokens.fontFamily.sans
  const titleFace = `${sans}_bold`
  const mediumFace = `${sans}_medium`

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: tokens.background },
        Platform.OS === 'web' ? { height: windowHeight } : null,
      ]}
    >
      <View style={styles.reader}>
        <ReaderPane book={chapter.bookId} chapter={String(chapter.chapter)} />
      </View>
      {open ? (
        <ChromeFrame>
          <Drawer
            chapter={chapter}
            icon={icon}
            verse={verse}
            shownTime={shownTime}
            duration={clock.duration}
            rate={rate}
            sleepMinutes={sleepMinutes}
            loadPhase={loadPhase}
            canGoPrevious={chapterIndex > 0}
            canGoNext={chapterIndex < AUDIO_CHAPTERS.length - 1}
            titleFace={titleFace}
            mediumFace={mediumFace}
            bodyFace={sans}
            onCollapse={onCollapse}
            onToolbarPress={onToolbarPress}
            onChapterStep={onChapterStep}
            onSeek={onSeek}
            onPreview={setPreviewTime}
            onSpeed={onSpeed}
            onSleep={onSleep}
            onRetry={onRetry}
          />
        </ChromeFrame>
      ) : (
        <ChromeFrame>
          <View style={styles.toolbarDock}>
            <LoadNotice loadPhase={loadPhase} bodyFace={sans} onRetry={onRetry} />
            <Toolbar
              chapter={chapter}
              icon={icon}
              progress={clock.duration > 0 ? shownTime / clock.duration : 0}
              titleFace={mediumFace}
              bodyFace={sans}
              onPress={onToolbarPress}
            />
          </View>
        </ChromeFrame>
      )}
    </View>
  )
}

function LoadNotice({
  loadPhase,
  bodyFace,
  onRetry,
}: {
  loadPhase: LoadPhase
  bodyFace: string
  onRetry: () => void
}) {
  const tokens = useTokens()
  if (loadPhase.kind === 'ready') return null
  if (loadPhase.kind === 'loading') {
    return (
      <Text
        style={[
          styles.notice,
          tokens.typography.sm,
          { color: tokens.mutedForeground, fontFamily: bodyFace },
        ]}
      >
        Getting the audio ready…
      </Text>
    )
  }
  return (
    <View
      style={[
        styles.errorBox,
        { backgroundColor: tokens.destructive, borderRadius: tokens.radius.surface },
      ]}
    >
      <Text
        style={[
          styles.errorText,
          tokens.typography.sm,
          { color: tokens.destructiveForeground, fontFamily: bodyFace },
        ]}
      >
        {loadPhase.message}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry}>
        <Text
          style={[
            tokens.typography.sm,
            { color: tokens.destructiveForeground, fontFamily: bodyFace },
          ]}
        >
          Retry
        </Text>
      </Pressable>
    </View>
  )
}

function Toolbar({
  chapter,
  icon,
  progress,
  titleFace,
  bodyFace,
  onPress,
}: {
  chapter: AudioChapter
  icon: 'play' | 'pause'
  progress: number
  titleFace: string
  bodyFace: string
  onPress: () => void
}) {
  const tokens = useTokens()
  let label = 'Play'
  if (icon === 'pause') label = 'Pause'
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: tokens.background,
          borderColor: tokens.border,
          borderRadius: tokens.radius.full,
        },
      ]}
    >
      <RoundTransport
        icon={icon}
        label={label}
        progress={progress}
        size={40}
        onPress={onPress}
      />
      <View style={styles.chapterSlot}>
        <Text
          style={[
            tokens.typography.lg,
            { color: tokens.foreground, fontFamily: bodyFace },
          ]}
        >
          ‹
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.chapterLabel,
            tokens.typography.base,
            { color: tokens.foreground, fontFamily: titleFace },
          ]}
        >
          {chapter.title}
        </Text>
        <Text
          style={[
            tokens.typography.lg,
            { color: tokens.foreground, fontFamily: bodyFace },
          ]}
        >
          ›
        </Text>
      </View>
      <View
        style={[
          styles.versionSlot,
          { backgroundColor: tokens.muted, borderRadius: tokens.radius.full },
        ]}
      >
        <Text
          style={[
            tokens.typography.sm,
            { color: tokens.foreground, fontFamily: titleFace },
          ]}
        >
          {chapter.versionLabel}
        </Text>
      </View>
    </View>
  )
}

function Drawer({
  chapter,
  icon,
  verse,
  shownTime,
  duration,
  rate,
  sleepMinutes,
  loadPhase,
  canGoPrevious,
  canGoNext,
  titleFace,
  mediumFace,
  bodyFace,
  onCollapse,
  onToolbarPress,
  onChapterStep,
  onSeek,
  onPreview,
  onSpeed,
  onSleep,
  onRetry,
}: {
  chapter: AudioChapter
  icon: 'play' | 'pause'
  verse: number | null
  shownTime: number
  duration: number
  rate: PlaybackRate
  sleepMinutes: SleepMinutes | null
  loadPhase: LoadPhase
  canGoPrevious: boolean
  canGoNext: boolean
  titleFace: string
  mediumFace: string
  bodyFace: string
  onCollapse: () => void
  onToolbarPress: () => void
  onChapterStep: (direction: -1 | 1) => void
  onSeek: (seconds: number) => void
  onPreview: (seconds: number | null) => void
  onSpeed: () => void
  onSleep: () => void
  onRetry: () => void
}) {
  const tokens = useTokens()
  let centerLabel = 'Play'
  if (icon === 'pause') centerLabel = 'Pause'
  return (
    <View
      style={[
        styles.drawer,
        {
          backgroundColor: tokens.background,
          borderColor: tokens.border,
          borderTopLeftRadius: tokens.radius.surface,
          borderTopRightRadius: tokens.radius.surface,
        },
      ]}
    >
      <View style={styles.drawerHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close player"
          hitSlop={8}
          onPress={onCollapse}
          style={styles.chevronButton}
        >
          <ChevronDown color={tokens.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text
            style={[
              tokens.typography.lg,
              { color: tokens.foreground, fontFamily: titleFace },
            ]}
          >
            {chapter.title}
          </Text>
          <Text
            style={[
              tokens.typography.sm,
              { color: tokens.mutedForeground, fontFamily: bodyFace },
            ]}
          >
            {chapter.versionLabel}
          </Text>
          <Text
            style={[
              tokens.typography.sm,
              { color: tokens.mutedForeground, fontFamily: bodyFace },
            ]}
          >
            Mock timing
          </Text>
        </View>
        <View style={styles.chevronButton} />
      </View>

      <LoadNotice loadPhase={loadPhase} bodyFace={bodyFace} onRetry={onRetry} />

      <View style={styles.transport}>
        <IconButton
          label="Previous chapter"
          disabled={!canGoPrevious}
          onPress={() => onChapterStep(-1)}
        >
          <ChapterSkip color={tokens.foreground} direction="previous" />
        </IconButton>
        <IconButton label="Back 15 seconds" onPress={() => onSeek(shownTime - SKIP_SECONDS)}>
          <SkipMark color={tokens.foreground} label="15" />
        </IconButton>
        <RoundTransport
          icon={icon}
          label={centerLabel}
          progress={0}
          size={58}
          filled
          onPress={onToolbarPress}
        />
        <IconButton label="Forward 15 seconds" onPress={() => onSeek(shownTime + SKIP_SECONDS)}>
          <SkipMark color={tokens.foreground} label="15" forward />
        </IconButton>
        <IconButton
          label="Next chapter"
          disabled={!canGoNext}
          onPress={() => onChapterStep(1)}
        >
          <ChapterSkip color={tokens.foreground} direction="next" />
        </IconButton>
      </View>

      <Scrubber
        verse={verse}
        position={shownTime}
        duration={duration}
        bodyFace={bodyFace}
        onPreview={onPreview}
        onSeek={onSeek}
      />

      <View style={styles.bottomRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Speed ${formatRate(rate)}`} onPress={onSpeed}>
          <Text
            style={[
              styles.speed,
              tokens.typography.base,
              { color: tokens.foreground, fontFamily: mediumFace },
            ]}
          >
            {formatRate(rate)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sleep timer ${formatSleep(sleepMinutes)}`}
          onPress={onSleep}
          style={styles.sleep}
        >
          <ClockIcon color={tokens.foreground} />
          <Text
            style={[
              tokens.typography.sm,
              { color: tokens.mutedForeground, fontFamily: bodyFace },
            ]}
          >
            {formatSleep(sleepMinutes)}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

function Scrubber({
  verse,
  position,
  duration,
  bodyFace,
  onPreview,
  onSeek,
}: {
  verse: number | null
  position: number
  duration: number
  bodyFace: string
  onPreview: (seconds: number | null) => void
  onSeek: (seconds: number) => void
}) {
  const tokens = useTokens()
  const widthRef = useRef(1)
  const fraction = duration > 0 ? position / duration : 0
  const bounded = unitInterval(fraction)

  function secondsFor(locationX: number) {
    const width = widthRef.current
    if (width <= 0) return 0
    return clampSeconds((locationX / width) * duration, duration)
  }

  let bubble = `Verse ${verse ?? ''}`
  if (verse === null) bubble = ''

  return (
    <View style={styles.scrubBlock}>
      <View style={[styles.bubbleRow, { marginLeft: `${bounded * 100}%` }]}>
        {verse === null ? null : (
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: tokens.card,
                borderColor: tokens.border,
                borderRadius: tokens.radius.surface,
              },
            ]}
          >
            <Text
              style={[
                tokens.typography.sm,
                { color: tokens.foreground, fontFamily: bodyFace },
              ]}
            >
              {bubble}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.scrubRow}>
        <Text
          style={[
            styles.time,
            tokens.typography.sm,
            { color: tokens.mutedForeground, fontFamily: bodyFace },
          ]}
        >
          {formatClock(position)}
        </Text>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Playback position"
          accessibilityValue={{ text: formatClock(position) }}
          style={styles.meterHit}
          onLayout={(event) => {
            widthRef.current = event.nativeEvent.layout.width
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => {
            onPreview(secondsFor(event.nativeEvent.locationX))
          }}
          onResponderMove={(event) => {
            onPreview(secondsFor(event.nativeEvent.locationX))
          }}
          onResponderRelease={(event) => {
            onPreview(null)
            onSeek(secondsFor(event.nativeEvent.locationX))
          }}
        >
          <View
            style={[
              styles.meterTrack,
              { backgroundColor: tokens.muted, borderRadius: tokens.radius.full },
            ]}
          >
            <View
              style={[
                styles.meterFill,
                { backgroundColor: tokens.foreground, width: `${bounded * 100}%` },
              ]}
            />
          </View>
        </View>
        <Text
          style={[
            styles.time,
            tokens.typography.sm,
            { color: tokens.mutedForeground, fontFamily: bodyFace },
          ]}
        >
          {formatRemaining(position, duration)}
        </Text>
      </View>
    </View>
  )
}

function RoundTransport({
  icon,
  label,
  progress,
  size,
  filled,
  onPress,
}: {
  icon: 'play' | 'pause'
  label: string
  progress: number
  size: number
  filled?: boolean
  onPress: () => void
}) {
  const tokens = useTokens()
  const stroke = 2
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const bounded = unitInterval(progress)
  const iconColor = filled ? tokens.background : tokens.foreground
  const disc = filled ? tokens.foreground : tokens.card
  const playLeft = size * 0.38
  const playTop = size * 0.28
  const playBottom = size * 0.72
  const playTip = size * 0.72
  const playMid = size * 0.5
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill={disc} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tokens.border}
          strokeWidth={stroke}
          fill="none"
        />
        {filled ? null : (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tokens.foreground}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - bounded)}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        )}
        {icon === 'pause' ? (
          <>
            <Rect
              x={size * 0.32}
              y={size * 0.28}
              width={size * 0.12}
              height={size * 0.44}
              rx={1}
              fill={iconColor}
            />
            <Rect
              x={size * 0.56}
              y={size * 0.28}
              width={size * 0.12}
              height={size * 0.44}
              rx={1}
              fill={iconColor}
            />
          </>
        ) : (
          <Path
            d={`M ${playLeft} ${playTop} L ${playLeft} ${playBottom} L ${playTip} ${playMid} Z`}
            fill={iconColor}
          />
        )}
      </Svg>
    </Pressable>
  )
}

function IconButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, disabled ? styles.iconDisabled : null]}
    >
      {children}
    </Pressable>
  )
}

function ChevronDown({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  )
}

function ChapterSkip({ color, direction }: { color: string; direction: 'previous' | 'next' }) {
  const previous = direction === 'previous'
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {previous ? <Rect x="5" y="6" width="2" height="12" fill={color} /> : null}
      <Path d={previous ? 'M18 6 L10 12 L18 18 Z' : 'M6 6 L14 12 L6 18 Z'} fill={color} />
      {previous ? null : <Rect x="17" y="6" width="2" height="12" fill={color} />}
    </Svg>
  )
}

function SkipMark({ color, label, forward }: { color: string; label: string; forward?: boolean }) {
  const glyph = (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M12 5a7 7 0 1 0 6.3 4"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M16 4l3.2 4.2L14.8 10" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  )
  return (
    <View style={styles.skipMark}>
      {forward ? <View style={styles.flip}>{glyph}</View> : glyph}
      <Text style={[styles.skipDigits, { color }]}>{label}</Text>
    </View>
  )
}

function unitInterval(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function ClockIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M12 8v4.5l3 2" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  reader: {
    flex: 1,
  },
  toolbarDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    zIndex: 2,
    gap: 8,
  },
  notice: {
    textAlign: 'center',
  },
  errorBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: {
    flex: 1,
  },
  pill: {
    minHeight: 52,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chapterSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chapterLabel: {
    flexShrink: 1,
  },
  versionSlot: {
    minWidth: 50,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  chevronButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDisabled: {
    opacity: 0.35,
  },
  scrubBlock: {
    gap: 4,
  },
  bubbleRow: {
    height: 28,
    alignItems: 'flex-start',
  },
  bubble: {
    marginLeft: -36,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    minWidth: 44,
  },
  meterHit: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  meterTrack: {
    height: 4,
    overflow: 'hidden',
  },
  meterFill: {
    height: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speed: {
    minWidth: 48,
  },
  sleep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skipMark: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipDigits: {
    position: 'absolute',
    fontSize: 8,
    lineHeight: 10,
  },
  flip: {
    transform: [{ scaleX: -1 }],
  },
})

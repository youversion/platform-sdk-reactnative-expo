import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import {
  AUDIO_CHAPTERS,
  DEFAULT_NARRATOR_ID,
  MOCK_NARRATORS,
  OPENING_CHAPTER_INDEX,
  PLAYBACK_RATES,
  READER_VERSION_ID,
  SKIP_SECONDS,
  SLEEP_MENU,
  chapterAt,
  clampSeconds,
  collapseDrawer,
  drawerIsOpen,
  formatClock,
  formatRate,
  formatRemaining,
  formatSleep,
  labelForVersion,
  loadPhaseAfterWait,
  narratorHeading,
  nextChapterIndex,
  nextListening,
  openDrawer,
  pressToolbar,
  showNarratorSelector,
  sleepDeadline,
  sleepShouldPause,
  toolbarIcon,
  verseAtTime,
  type AudioChapter,
  type Chrome,
  type LoadPhase,
  type Narrator,
  type PlaybackRate,
  type SleepMinutes,
} from '../../src/audio/session'
import { ChromeFrame } from '../../src/audio/chrome-frame'
import { GuidedReader } from '../../src/audio/guided-reader'

const STATUS_TICK_MS = 200

/** iOS tab bar floats over the screen. Safe area is only the home indicator. */
const IOS_TAB_BAR_CONTENT_HEIGHT = 49
const TOOLBAR_BOTTOM_GAP = 12

function useAudioChromeInset(): number {
  const { bottom } = useSafeAreaInsets()
  if (Platform.OS === 'ios') {
    return IOS_TAB_BAR_CONTENT_HEIGHT + bottom
  }
  return 0
}

type AudioSheet = 'speed' | 'sleep' | 'narrator'

type Clock = {
  currentTime: number
  duration: number
}

export default function AudioScreen() {
  const tokens = useTokens()
  const chromeInset = useAudioChromeInset()
  const [chapterIndex, setChapterIndex] = useState(OPENING_CHAPTER_INDEX)
  const [chrome, setChrome] = useState<Chrome>({ kind: 'idle' })
  const [loadPhase, setLoadPhase] = useState<LoadPhase>({ kind: 'loading' })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [rate, setRate] = useState<PlaybackRate>(1)
  const [sleepMinutes, setSleepMinutes] = useState<SleepMinutes | null>(null)
  const [narratorId, setNarratorId] = useState<string>(DEFAULT_NARRATOR_ID)
  const [sheet, setSheet] = useState<AudioSheet | null>(null)
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null)
  const [clock, setClock] = useState<Clock>({ currentTime: 0, duration: 0 })
  const [previewTime, setPreviewTime] = useState<number | null>(null)
  const [heldTime, setHeldTime] = useState<number | null>(null)
  // The player card's height above the tab bar, so the followed verse lands above it.
  const [chromeHeight, setChromeHeight] = useState(0)

  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null)
  const loadedRef = useRef(false)
  const failedRef = useRef(false)
  const rateRef = useRef(rate)
  const chromeRef = useRef(chrome)
  const chapterIndexRef = useRef(chapterIndex)
  const finishConsumedRef = useRef(false)
  const heldTarget = useRef<number | null>(null)
  const seekGeneration = useRef(0)
  rateRef.current = rate
  chromeRef.current = chrome
  chapterIndexRef.current = chapterIndex

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
      const step = nextListening(
        {
          didJustFinish: status.didJustFinish,
          failed: failedRef.current,
          finishConsumed: finishConsumedRef.current,
        },
        { chapterIndex: chapterIndexRef.current, chrome: chromeRef.current },
        AUDIO_CHAPTERS.length,
      )
      finishConsumedRef.current = step.finishConsumed
      if (step.listening.chrome !== chromeRef.current) {
        chromeRef.current = step.listening.chrome
        setChrome(step.listening.chrome)
        applyTransport(step.listening.chrome)
      }
      if (step.load) {
        chapterIndexRef.current = step.listening.chapterIndex
        setChapterIndex(step.listening.chapterIndex)
        loadChapter(step.listening.chapterIndex)
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

  let playhead = clock.currentTime
  if (heldTime !== null) playhead = heldTime
  let shownTime = playhead
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
    setSheet(null)
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

  function onOpenSheet(next: AudioSheet) {
    setSheet((current) => (current === next ? null : next))
  }

  function onPickRate(next: PlaybackRate) {
    setRate(next)
    playerRef.current?.setPlaybackRate(next)
    setSheet(null)
  }

  function onPickSleep(next: SleepMinutes | null) {
    setSleepMinutes(next)
    if (next === null) {
      setSleepEndsAt(null)
    } else {
      setSleepEndsAt(sleepDeadline(Date.now(), next))
    }
    setSheet(null)
  }

  function onPickNarrator(next: string) {
    setNarratorId(next)
    setSheet(null)
  }

  function onOpenFromPill() {
    setChrome((current) => openDrawer(current))
  }

  const open = drawerIsOpen(chrome)
  const icon = toolbarIcon(chrome)
  const version = labelForVersion(READER_VERSION_ID)
  const narrator = narratorById(narratorId)
  const sans = tokens.fontFamily.sans
  const titleFace = `${sans}_bold`
  const mediumFace = `${sans}_medium`

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <GuidedReader
        chapter={chapter}
        followSeconds={playhead}
        bottomInset={chromeHeight}
        onSeek={onSeek}
      />
      {open ? (
        <ChromeFrame>
          <Drawer
            chapter={chapter}
            version={version}
            icon={icon}
            shownTime={shownTime}
            duration={clock.duration}
            rate={rate}
            sleepMinutes={sleepMinutes}
            narrator={narrator}
            showNarrators={showNarratorSelector(MOCK_NARRATORS)}
            sheet={sheet}
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
            onOpenSheet={onOpenSheet}
            onPickRate={onPickRate}
            onPickSleep={onPickSleep}
            onPickNarrator={onPickNarrator}
            onRetry={onRetry}
            onLayout={(event) => setChromeHeight(DRAWER_GAP + event.nativeEvent.layout.height)}
          />
        </ChromeFrame>
      ) : (
        <ChromeFrame>
          <View
            style={[styles.toolbarDock, { bottom: TOOLBAR_BOTTOM_GAP + chromeInset }]}
            onLayout={(event) =>
              setChromeHeight(TOOLBAR_BOTTOM_GAP + event.nativeEvent.layout.height)
            }
          >
            <LoadNotice loadPhase={loadPhase} bodyFace={sans} onRetry={onRetry} />
            <Toolbar
              chapter={chapter}
              version={version}
              icon={icon}
              progress={clock.duration > 0 ? shownTime / clock.duration : 0}
              canGoPrevious={chapterIndex > 0}
              canGoNext={chapterIndex < AUDIO_CHAPTERS.length - 1}
              titleFace={mediumFace}
              onPress={onToolbarPress}
              onOpen={onOpenFromPill}
              onChapterStep={onChapterStep}
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

function narratorById(id: string): Narrator {
  for (const narrator of MOCK_NARRATORS) {
    if (narrator.id === id) return narrator
  }
  return MOCK_NARRATORS[0]
}

function floatingShadow(color: string) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  }
}

function Toolbar({
  chapter,
  version,
  icon,
  progress,
  canGoPrevious,
  canGoNext,
  titleFace,
  onPress,
  onOpen,
  onChapterStep,
}: {
  chapter: AudioChapter
  version: string
  icon: 'play' | 'pause'
  progress: number
  canGoPrevious: boolean
  canGoNext: boolean
  titleFace: string
  onPress: () => void
  onOpen: () => void
  onChapterStep: (direction: -1 | 1) => void
}) {
  const tokens = useTokens()
  const shadow = floatingShadow(tokens.foreground)
  let label = 'Play'
  if (icon === 'pause') label = 'Pause'
  return (
    <View style={styles.toolbarRow}>
      <View
        style={[
          styles.roundFloat,
          shadow,
          { backgroundColor: tokens.popover, borderRadius: tokens.radius.full },
        ]}
      >
        <RoundTransport
          icon={icon}
          label={label}
          progress={progress}
          size={FLOAT_SIZE}
          onPress={onPress}
        />
      </View>
      <View
        style={[
          styles.pill,
          shadow,
          { backgroundColor: tokens.popover, borderRadius: tokens.radius.full },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous chapter"
          accessibilityState={{ disabled: !canGoPrevious }}
          disabled={!canGoPrevious}
          hitSlop={8}
          onPress={() => onChapterStep(-1)}
          style={[styles.pillChevron, !canGoPrevious ? styles.iconDisabled : null]}
        >
          <Chevron color={tokens.foreground} direction="left" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open player"
          onPress={onOpen}
          style={styles.chapterSlot}
        >
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
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next chapter"
          accessibilityState={{ disabled: !canGoNext }}
          disabled={!canGoNext}
          hitSlop={8}
          onPress={() => onChapterStep(1)}
          style={[styles.pillChevron, !canGoNext ? styles.iconDisabled : null]}
        >
          <Chevron color={tokens.foreground} direction="right" />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open player"
        onPress={onOpen}
        style={[
          styles.roundFloat,
          shadow,
          { backgroundColor: tokens.popover, borderRadius: tokens.radius.full },
        ]}
      >
        <Text
          style={[
            tokens.typography.sm,
            { color: tokens.foreground, fontFamily: titleFace },
          ]}
        >
          {version}
        </Text>
      </Pressable>
    </View>
  )
}

function Drawer({
  chapter,
  version,
  icon,
  shownTime,
  duration,
  rate,
  sleepMinutes,
  narrator,
  showNarrators,
  sheet,
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
  onOpenSheet,
  onPickRate,
  onPickSleep,
  onPickNarrator,
  onRetry,
  onLayout,
}: {
  chapter: AudioChapter
  version: string
  icon: 'play' | 'pause'
  shownTime: number
  duration: number
  rate: PlaybackRate
  sleepMinutes: SleepMinutes | null
  narrator: Narrator
  showNarrators: boolean
  sheet: AudioSheet | null
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
  onOpenSheet: (next: AudioSheet) => void
  onPickRate: (next: PlaybackRate) => void
  onPickSleep: (next: SleepMinutes | null) => void
  onPickNarrator: (next: string) => void
  onRetry: () => void
  onLayout: (event: LayoutChangeEvent) => void
}) {
  const tokens = useTokens()
  const chromeInset = useAudioChromeInset()
  let centerLabel = 'Play'
  if (icon === 'pause') centerLabel = 'Pause'
  const versionText = (
    <Text
      style={[
        styles.versionCaption,
        { color: tokens.mutedForeground, fontFamily: bodyFace },
      ]}
    >
      {version}
    </Text>
  )
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.drawer,
        floatingShadow(tokens.foreground),
        {
          backgroundColor: tokens.popover,
          bottom: DRAWER_GAP + chromeInset,
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
          <ChevronDown color={tokens.mutedForeground} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={[styles.drawerTitle, { color: tokens.foreground, fontFamily: mediumFace }]}
        >
          {chapter.title}
        </Text>
        {showNarrators ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${version}, narrator ${narrator.title}`}
            hitSlop={8}
            onPress={() => onOpenSheet('narrator')}
          >
            {versionText}
          </Pressable>
        ) : (
          versionText
        )}
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
        <IconButton
          label={`Back ${SKIP_SECONDS} seconds`}
          onPress={() => onSeek(shownTime - SKIP_SECONDS)}
        >
          <SkipMark color={tokens.foreground} face={titleFace} label={String(SKIP_SECONDS)} />
        </IconButton>
        <RoundTransport
          icon={icon}
          label={centerLabel}
          progress={0}
          size={64}
          filled
          onPress={onToolbarPress}
        />
        <IconButton
          label={`Forward ${SKIP_SECONDS} seconds`}
          onPress={() => onSeek(shownTime + SKIP_SECONDS)}
        >
          <SkipMark
            color={tokens.foreground}
            face={titleFace}
            label={String(SKIP_SECONDS)}
            forward
          />
        </IconButton>
        <IconButton
          label="Next chapter"
          disabled={!canGoNext}
          onPress={() => onChapterStep(1)}
        >
          <ChapterSkip color={tokens.foreground} direction="next" />
        </IconButton>
      </View>

      {sheet === 'speed' ? (
        <ChoiceList
          label="Playback speed"
          bodyFace={bodyFace}
          titleFace={titleFace}
          rows={PLAYBACK_RATES.map((choice) => ({
            id: formatRate(choice),
            label: formatRate(choice),
            selected: choice === rate,
            onPress: () => onPickRate(choice),
          }))}
        />
      ) : null}
      {sheet === 'sleep' ? (
        <ChoiceList
          label="Sleep timer"
          bodyFace={bodyFace}
          titleFace={titleFace}
          rows={SLEEP_MENU.map((choice) => ({
            id: choice.label,
            label: choice.label,
            selected: choice.minutes === sleepMinutes,
            onPress: () => onPickSleep(choice.minutes),
          }))}
        />
      ) : null}
      {sheet === 'narrator' ? (
        <NarratorSheet
          version={version}
          narratorId={narrator.id}
          bodyFace={bodyFace}
          titleFace={titleFace}
          onPick={onPickNarrator}
        />
      ) : null}

      <View style={styles.bottomRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Speed ${formatRate(rate)}`}
          hitSlop={8}
          onPress={() => onOpenSheet('speed')}
          style={styles.speed}
        >
          <Text style={[styles.speedText, { color: tokens.foreground, fontFamily: titleFace }]}>
            {formatRate(rate).toUpperCase()}
          </Text>
        </Pressable>
        <Scrubber
          chapter={chapter}
          position={shownTime}
          duration={duration}
          bodyFace={bodyFace}
          mediumFace={mediumFace}
          onPreview={onPreview}
          onSeek={onSeek}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sleep timer ${formatSleep(sleepMinutes)}`}
          hitSlop={8}
          onPress={() => onOpenSheet('sleep')}
        >
          <ClockIcon color={tokens.foreground} />
        </Pressable>
      </View>
    </View>
  )
}

function ChoiceList({
  label,
  rows,
  bodyFace,
  titleFace,
}: {
  label: string
  rows: readonly { id: string; label: string; selected: boolean; onPress: () => void }[]
  bodyFace: string
  titleFace: string
}) {
  const tokens = useTokens()
  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.menu,
        {
          backgroundColor: tokens.card,
          borderColor: tokens.border,
          borderRadius: tokens.radius.surface,
        },
      ]}
    >
      {rows.map((row) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={row.selected ? `${row.label} selected` : row.label}
          accessibilityState={{ selected: row.selected }}
          onPress={row.onPress}
          style={styles.menuRow}
        >
          <Text
            style={[
              styles.check,
              tokens.typography.base,
              { color: tokens.foreground, fontFamily: titleFace },
            ]}
          >
            {row.selected ? '✓' : ''}
          </Text>
          <Text
            style={[
              tokens.typography.base,
              { color: tokens.foreground, fontFamily: bodyFace },
            ]}
          >
            {row.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

function NarratorSheet({
  version,
  narratorId,
  bodyFace,
  titleFace,
  onPick,
}: {
  version: string
  narratorId: string
  bodyFace: string
  titleFace: string
  onPick: (id: string) => void
}) {
  const tokens = useTokens()
  return (
    <View accessibilityLabel="Narrator list" style={styles.narratorSheet}>
      <ChoiceList
        label="Narrators"
        bodyFace={bodyFace}
        titleFace={titleFace}
        rows={MOCK_NARRATORS.map((choice) => ({
          id: choice.id,
          label: choice.title,
          selected: choice.id === narratorId,
          onPress: () => onPick(choice.id),
        }))}
      />
      <Text
        style={[
          tokens.typography.sm,
          { color: tokens.mutedForeground, fontFamily: bodyFace },
        ]}
      >
        {narratorHeading(version)}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Switch Version" onPress={() => undefined}>
        <Text
          style={[
            tokens.typography.base,
            { color: tokens.foreground, fontFamily: titleFace },
          ]}
        >
          Switch Version
        </Text>
      </Pressable>
      <Text
        style={[
          tokens.typography.sm,
          { color: tokens.mutedForeground, fontFamily: bodyFace },
        ]}
      >
        Mock
      </Text>
    </View>
  )
}

function Scrubber({
  chapter,
  position,
  duration,
  bodyFace,
  mediumFace,
  onPreview,
  onSeek,
}: {
  chapter: AudioChapter
  position: number
  duration: number
  bodyFace: string
  mediumFace: string
  onPreview: (seconds: number | null) => void
  onSeek: (seconds: number) => void
}) {
  const tokens = useTokens()
  const widthRef = useRef(1)
  const [trackWidth, setTrackWidth] = useState(0)
  const fraction = duration > 0 ? position / duration : 0
  const bounded = unitInterval(fraction)
  const thumbX = bounded * trackWidth
  const verse = verseAtTime(chapter.mockVerseTimings, position)

  function secondsFor(locationX: number) {
    const width = widthRef.current
    if (width <= 0) return 0
    return clampSeconds((locationX / width) * duration, duration)
  }

  return (
    <View style={styles.scrubRow}>
      <Text style={[styles.time, { color: tokens.foreground, fontFamily: bodyFace }]}>
        {formatClock(position)}
      </Text>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityValue={{ text: formatClock(position) }}
        style={styles.meterHit}
        onLayout={(event) => {
          widthRef.current = event.nativeEvent.layout.width
          setTrackWidth(event.nativeEvent.layout.width)
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
          pointerEvents="none"
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
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: thumbX - THUMB_SIZE / 2,
              backgroundColor: tokens.foreground,
              borderRadius: tokens.radius.full,
            },
          ]}
        />
        {verse !== null && trackWidth > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.verseTip,
              floatingShadow(tokens.foreground),
              {
                left: thumbX - VERSE_TIP_WIDTH / 2,
                backgroundColor: tokens.popover,
                borderRadius: tokens.radius.full,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.verseTipText, { color: tokens.foreground, fontFamily: mediumFace }]}
            >
              {`Verse ${verse}`}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.time, { color: tokens.foreground, fontFamily: bodyFace }]}>
        {formatRemaining(position, duration)}
      </Text>
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
  const disc = filled ? tokens.foreground : tokens.popover
  const playLeft = size * 0.38
  const playTop = size * 0.3
  const playBottom = size * 0.7
  const playTip = size * 0.7
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
        {filled ? null : (
          <>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={tokens.muted}
              strokeWidth={stroke}
              fill="none"
            />
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
          </>
        )}
        {icon === 'pause' ? (
          <>
            <Rect
              x={size * 0.35}
              y={size * 0.31}
              width={size * 0.1}
              height={size * 0.38}
              rx={size * 0.02}
              fill={iconColor}
            />
            <Rect
              x={size * 0.55}
              y={size * 0.31}
              width={size * 0.1}
              height={size * 0.38}
              rx={size * 0.02}
              fill={iconColor}
            />
          </>
        ) : (
          <Path
            d={`M ${playLeft} ${playTop} L ${playLeft} ${playBottom} L ${playTip} ${playMid} Z`}
            fill={iconColor}
            stroke={iconColor}
            strokeLinejoin="round"
            strokeWidth={size * 0.03}
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
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function Chevron({ color, direction }: { color: string; direction: 'left' | 'right' }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ChapterSkip({ color, direction }: { color: string; direction: 'previous' | 'next' }) {
  const previous = direction === 'previous'
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Rect x={previous ? 5 : 20} y="6" width="3" height="16" rx="1" fill={color} />
      <Path
        d={previous ? 'M22 7 L10 14 L22 21 Z' : 'M6 7 L18 14 L6 21 Z'}
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function SkipMark({
  color,
  face,
  label,
  forward,
}: {
  color: string
  face: string
  label: string
  forward?: boolean
}) {
  // Drawn as rewind (counter-clockwise, arrowhead at top pointing left);
  // forward mirrors it.
  const glyph = (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Path
        d="M10 6.3 A10 10 0 1 0 15 5"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M11 5 L16 1.8 L16 8.2 Z" fill={color} />
    </Svg>
  )
  return (
    <View style={styles.skipMark}>
      {forward ? <View style={styles.flip}>{glyph}</View> : glyph}
      <View pointerEvents="none" style={styles.skipDigitsFrame}>
        <Text style={[styles.skipDigits, { color, fontFamily: face }]}>{label}</Text>
      </View>
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
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  )
}

const FLOAT_SIZE = 48
const DRAWER_GAP = 8
const THUMB_SIZE = 16
const VERSE_TIP_WIDTH = 76

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  toolbarDock: {
    position: 'absolute',
    left: 16,
    right: 16,
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
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundFloat: {
    width: FLOAT_SIZE,
    height: FLOAT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    height: FLOAT_SIZE,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillChevron: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterSlot: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterLabel: {
    flexShrink: 1,
  },
  drawer: {
    position: 'absolute',
    left: DRAWER_GAP,
    right: DRAWER_GAP,
    zIndex: 2,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 16,
  },
  drawerHeader: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  chevronButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  versionCaption: {
    fontSize: 13,
    lineHeight: 18,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
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
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 20,
  },
  speed: {
    minWidth: 28,
  },
  speedText: {
    fontSize: 15,
    lineHeight: 20,
  },
  scrubRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  time: {
    fontSize: 13,
    lineHeight: 18,
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
  thumb: {
    position: 'absolute',
    top: (28 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  verseTip: {
    position: 'absolute',
    bottom: 30,
    width: VERSE_TIP_WIDTH,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verseTipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  menu: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  check: {
    width: 16,
  },
  narratorSheet: {
    gap: 8,
  },
  skipMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipDigitsFrame: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipDigits: {
    fontSize: 10,
    lineHeight: 12,
  },
  flip: {
    transform: [{ scaleX: -1 }],
  },
})

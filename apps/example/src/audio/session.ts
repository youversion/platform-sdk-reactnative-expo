export const SKIP_SECONDS = 30
export const LOAD_LIMIT_MS = 8_000
export const LOAD_ERROR_MESSAGE = "This chapter's audio didn't load."

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]
export const DEFAULT_PLAYBACK_RATE: PlaybackRate = 1

export const SLEEP_MINUTES = [5, 10, 15, 30, 60, 120] as const
export type SleepMinutes = (typeof SLEEP_MINUTES)[number]

export const SLEEP_MENU = [
  { minutes: null, label: 'Off' },
  { minutes: 5, label: '5m' },
  { minutes: 10, label: '10m' },
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
] as const

export const READER_VERSION_ID = 3034

export type Narrator = {
  id: string
  title: string
}

export const MOCK_NARRATORS = [
  { id: 'bsb-reader', title: 'BSB Reader' },
  { id: 'bsb-dramatized', title: 'BSB Dramatized' },
] as const satisfies readonly Narrator[]

export const DEFAULT_NARRATOR_ID = MOCK_NARRATORS[0].id

export type VerseTiming = {
  verse: number
  startSeconds: number
  endSeconds: number
}

export type AudioChapter = {
  bookId: 'HEB'
  chapter: number
  title: string
  uri: string
  mockVerseTimings: readonly VerseTiming[]
}

const HEBREWS_10: AudioChapter = {
  bookId: 'HEB',
  chapter: 10,
  title: 'Hebrews 10',
  uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  mockVerseTimings: [
    { verse: 1, startSeconds: 0, endSeconds: 15 },
    { verse: 2, startSeconds: 15, endSeconds: 30 },
  ],
}

function hebrews11VerseTimings(): readonly VerseTiming[] {
  const timings: VerseTiming[] = []
  for (let verse = 1; verse <= 40; verse += 1) {
    timings.push({
      verse,
      startSeconds: (verse - 1) * 10,
      endSeconds: verse * 10,
    })
  }
  return timings
}

const HEBREWS_11: AudioChapter = {
  bookId: 'HEB',
  chapter: 11,
  title: 'Hebrews 11',
  uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  mockVerseTimings: hebrews11VerseTimings(),
}

const HEBREWS_12: AudioChapter = {
  bookId: 'HEB',
  chapter: 12,
  title: 'Hebrews 12',
  uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  mockVerseTimings: [
    { verse: 1, startSeconds: 0, endSeconds: 18 },
    { verse: 2, startSeconds: 18, endSeconds: 36 },
  ],
}

export const AUDIO_CHAPTERS = [HEBREWS_10, HEBREWS_11, HEBREWS_12] as const
export const OPENING_CHAPTER_INDEX = 1

export function chapterAt(index: number): AudioChapter {
  if (index <= 0) return HEBREWS_10
  if (index === 1) return HEBREWS_11
  return HEBREWS_12
}

export function nextChapterIndex(index: number, count: number, direction: -1 | 1): number {
  const next = index + direction
  if (next < 0) return 0
  if (next >= count) return count - 1
  return next
}

export function verseAtTime(timings: readonly VerseTiming[], seconds: number): number | null {
  for (const timing of timings) {
    if (seconds >= timing.startSeconds && seconds < timing.endSeconds) {
      return timing.verse
    }
  }
  return null
}

export function nextFollowedVerse(
  timings: readonly VerseTiming[],
  seconds: number,
  previousVerse: number | null,
): number | null {
  const verse = verseAtTime(timings, seconds)
  if (verse === null) return null
  if (verse === previousVerse) return null
  return verse
}

export function verseStartSeconds(timings: readonly VerseTiming[], verse: number): number | null {
  for (const timing of timings) {
    if (timing.verse === verse) return timing.startSeconds
  }
  return null
}

export type Listening = {
  chapterIndex: number
  chrome: Chrome
}

export type TrackEnd = {
  didJustFinish: boolean
  failed: boolean
  finishConsumed: boolean
}

export type ListeningStep = {
  listening: Listening
  finishConsumed: boolean
  load: boolean
}

function chromeWithTransport(chrome: Chrome, transport: 'playing' | 'paused'): Chrome {
  if (chrome.kind !== 'session' || chrome.transport === transport) return chrome
  return { kind: 'session', drawer: chrome.drawer, transport }
}

export function nextListening(track: TrackEnd, listening: Listening, count: number): ListeningStep {
  const { didJustFinish, failed, finishConsumed } = track
  const { chapterIndex, chrome } = listening

  if (failed) {
    let consumed = finishConsumed
    if (didJustFinish) consumed = true
    return {
      listening: { chapterIndex, chrome: chromeWithTransport(chrome, 'paused') },
      finishConsumed: consumed,
      load: false,
    }
  }

  if (didJustFinish && finishConsumed) {
    return { listening, finishConsumed: true, load: false }
  }

  if (didJustFinish && (chrome.kind === 'idle' || chrome.transport === 'paused')) {
    return { listening, finishConsumed: true, load: false }
  }

  if (didJustFinish) {
    const chapterIndexNext = nextChapterIndex(chapterIndex, count, 1)
    if (chapterIndexNext === chapterIndex) {
      return {
        listening: { chapterIndex, chrome: chromeWithTransport(chrome, 'paused') },
        finishConsumed: true,
        load: false,
      }
    }
    return {
      listening: { chapterIndex: chapterIndexNext, chrome },
      finishConsumed: true,
      load: true,
    }
  }

  return { listening, finishConsumed: false, load: false }
}

export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const minutes = Math.floor(safe / 60)
  const remain = safe % 60
  const padded = remain < 10 ? `0${remain}` : String(remain)
  return `${minutes}:${padded}`
}

export function formatRemaining(current: number, duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) return '-0:00'
  const left = Math.max(0, duration - current)
  return `-${formatClock(left)}`
}

export function formatRate(rate: PlaybackRate): string {
  return `${rate}x`
}

export function speedLabels(): readonly string[] {
  return PLAYBACK_RATES.map(formatRate)
}

export function formatSleep(minutes: SleepMinutes | null): string {
  for (const choice of SLEEP_MENU) {
    if (choice.minutes === minutes) return choice.label
  }
  return 'Off'
}

export function sleepLabels(): readonly string[] {
  return SLEEP_MENU.map((choice) => choice.label)
}

export function labelForVersion(versionId: number): string {
  if (versionId === READER_VERSION_ID) return 'BSB'
  return String(versionId)
}

export function showNarratorSelector(narrators: readonly Narrator[]): boolean {
  return narrators.length > 1
}

export function narratorHeading(version: string): string {
  return `Viewing Audio Bibles for ${version}`
}

export function clampSeconds(seconds: number, duration: number): number {
  const upper = Number.isFinite(duration) && duration > 0 ? duration : 0
  if (seconds < 0) return 0
  if (seconds > upper) return upper
  return seconds
}

export function sleepDeadline(nowMs: number, minutes: SleepMinutes): number {
  return nowMs + minutes * 60_000
}

export function sleepShouldPause(nowMs: number, deadlineMs: number | null): boolean {
  if (deadlineMs === null) return false
  return nowMs >= deadlineMs
}

export type LoadPhase = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }

export function loadPhaseAfterWait(
  phase: LoadPhase,
  isLoaded: boolean,
  elapsedMs: number,
  playerFailed: boolean,
): LoadPhase {
  if (playerFailed) return { kind: 'error', message: LOAD_ERROR_MESSAGE }
  if (phase.kind === 'ready') return phase
  if (isLoaded) return { kind: 'ready' }
  if (phase.kind === 'error') return phase
  if (elapsedMs >= LOAD_LIMIT_MS) return { kind: 'error', message: LOAD_ERROR_MESSAGE }
  return { kind: 'loading' }
}

export type Chrome =
  | { kind: 'idle' }
  | { kind: 'session'; drawer: 'closed' | 'open'; transport: 'playing' | 'paused' }

export function toolbarIcon(chrome: Chrome): 'play' | 'pause' {
  if (chrome.kind === 'session' && chrome.transport === 'playing') return 'pause'
  return 'play'
}

export function pressToolbar(chrome: Chrome): Chrome {
  if (chrome.kind === 'idle') {
    return { kind: 'session', drawer: 'open', transport: 'playing' }
  }
  if (chrome.transport === 'playing') {
    return { kind: 'session', drawer: chrome.drawer, transport: 'paused' }
  }
  return { kind: 'session', drawer: chrome.drawer, transport: 'playing' }
}

export function collapseDrawer(chrome: Chrome): Chrome {
  if (chrome.kind === 'idle') return chrome
  return { kind: 'session', drawer: 'closed', transport: chrome.transport }
}

export function drawerIsOpen(chrome: Chrome): boolean {
  return chrome.kind === 'session' && chrome.drawer === 'open'
}

export function openDrawer(chrome: Chrome): Chrome {
  if (chrome.kind === 'idle') {
    return { kind: 'session', drawer: 'open', transport: 'paused' }
  }
  return { kind: 'session', drawer: 'open', transport: chrome.transport }
}

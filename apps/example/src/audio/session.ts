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
  uri: 'https://audio.bible.helloao.org/api/BSB/HEB/10/audio/souer.mp3',
  mockVerseTimings: [
    { verse: 1, startSeconds: 0, endSeconds: 15 },
    { verse: 2, startSeconds: 15, endSeconds: 30 },
  ],
}

// Timed from the Souer narration: verse ends fit to its pauses. Each verse runs to
// the next one's start so the bar holds through the breath between them.
const HEBREWS_11_VERSE_TIMINGS: readonly VerseTiming[] = [
  { verse: 1, startSeconds: 4.85, endSeconds: 10.5 },
  { verse: 2, startSeconds: 10.5, endSeconds: 12.88 },
  { verse: 3, startSeconds: 12.88, endSeconds: 20.65 },
  { verse: 4, startSeconds: 20.65, endSeconds: 32.59 },
  { verse: 5, startSeconds: 32.59, endSeconds: 44.12 },
  { verse: 6, startSeconds: 44.12, endSeconds: 53.67 },
  { verse: 7, startSeconds: 53.67, endSeconds: 65.21 },
  { verse: 8, startSeconds: 65.21, endSeconds: 73.89 },
  { verse: 9, startSeconds: 73.89, endSeconds: 83.33 },
  { verse: 10, startSeconds: 83.33, endSeconds: 88.89 },
  { verse: 11, startSeconds: 88.89, endSeconds: 98.06 },
  { verse: 12, startSeconds: 98.06, endSeconds: 107.93 },
  { verse: 13, startSeconds: 107.93, endSeconds: 120.28 },
  { verse: 14, startSeconds: 120.28, endSeconds: 125.45 },
  { verse: 15, startSeconds: 125.45, endSeconds: 130.95 },
  { verse: 16, startSeconds: 130.95, endSeconds: 139.59 },
  { verse: 17, startSeconds: 139.59, endSeconds: 148.33 },
  { verse: 18, startSeconds: 148.33, endSeconds: 153.11 },
  { verse: 19, startSeconds: 153.11, endSeconds: 159.87 },
  { verse: 20, startSeconds: 159.87, endSeconds: 164.35 },
  { verse: 21, startSeconds: 164.35, endSeconds: 171.03 },
  { verse: 22, startSeconds: 171.03, endSeconds: 178.05 },
  { verse: 23, startSeconds: 178.05, endSeconds: 187.21 },
  { verse: 24, startSeconds: 187.21, endSeconds: 191.95 },
  { verse: 25, startSeconds: 191.95, endSeconds: 197.95 },
  { verse: 26, startSeconds: 197.95, endSeconds: 204.04 },
  { verse: 27, startSeconds: 204.04, endSeconds: 211.35 },
  { verse: 28, startSeconds: 211.35, endSeconds: 219.59 },
  { verse: 29, startSeconds: 219.59, endSeconds: 227.52 },
  { verse: 30, startSeconds: 227.52, endSeconds: 233.33 },
  { verse: 31, startSeconds: 233.33, endSeconds: 242.1 },
  { verse: 32, startSeconds: 242.1, endSeconds: 250.04 },
  { verse: 33, startSeconds: 250.04, endSeconds: 256.19 },
  { verse: 34, startSeconds: 256.19, endSeconds: 264.68 },
  { verse: 35, startSeconds: 264.68, endSeconds: 273.51 },
  { verse: 36, startSeconds: 273.51, endSeconds: 278.25 },
  { verse: 37, startSeconds: 278.25, endSeconds: 287.8 },
  { verse: 38, startSeconds: 287.8, endSeconds: 294.45 },
  { verse: 39, startSeconds: 294.45, endSeconds: 299.76 },
  { verse: 40, startSeconds: 299.76, endSeconds: 306.05 },
]

const HEBREWS_11: AudioChapter = {
  bookId: 'HEB',
  chapter: 11,
  title: 'Hebrews 11',
  uri: 'https://audio.bible.helloao.org/api/BSB/HEB/11/audio/souer.mp3',
  mockVerseTimings: HEBREWS_11_VERSE_TIMINGS,
}

const HEBREWS_12: AudioChapter = {
  bookId: 'HEB',
  chapter: 12,
  title: 'Hebrews 12',
  uri: 'https://audio.bible.helloao.org/api/BSB/HEB/12/audio/souer.mp3',
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

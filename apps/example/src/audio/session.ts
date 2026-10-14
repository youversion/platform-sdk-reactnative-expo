export const SKIP_SECONDS = 15
export const LOAD_LIMIT_MS = 8_000
export const LOAD_ERROR_MESSAGE = "This chapter's audio didn't load."

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export const SLEEP_CHOICES = [5, 15, 30, 60] as const
export type SleepMinutes = (typeof SLEEP_CHOICES)[number]

export type VerseTiming = {
  verse: number
  startSeconds: number
  endSeconds: number
}

export type AudioChapter = {
  bookId: 'HEB'
  chapter: number
  title: string
  versionLabel: 'NIV'
  uri: string
  mockVerseTimings: readonly VerseTiming[]
}

const HEBREWS_10: AudioChapter = {
  bookId: 'HEB',
  chapter: 10,
  title: 'Hebrews 10',
  versionLabel: 'NIV',
  uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  mockVerseTimings: [
    { verse: 1, startSeconds: 0, endSeconds: 15 },
    { verse: 2, startSeconds: 15, endSeconds: 30 },
  ],
}

const HEBREWS_11: AudioChapter = {
  bookId: 'HEB',
  chapter: 11,
  title: 'Hebrews 11',
  versionLabel: 'NIV',
  uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  mockVerseTimings: [
    { verse: 1, startSeconds: 0, endSeconds: 12 },
    { verse: 2, startSeconds: 12, endSeconds: 22 },
    { verse: 3, startSeconds: 22, endSeconds: 36 },
    { verse: 4, startSeconds: 36, endSeconds: 52 },
    { verse: 5, startSeconds: 52, endSeconds: 70 },
  ],
}

const HEBREWS_12: AudioChapter = {
  bookId: 'HEB',
  chapter: 12,
  title: 'Hebrews 12',
  versionLabel: 'NIV',
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

export function formatSleep(minutes: SleepMinutes | null): string {
  if (minutes === null) return 'Off'
  return `${minutes}m`
}

export function clampSeconds(seconds: number, duration: number): number {
  const upper = Number.isFinite(duration) && duration > 0 ? duration : 0
  if (seconds < 0) return 0
  if (seconds > upper) return upper
  return seconds
}

export function nextPlaybackRate(rate: PlaybackRate): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(rate)
  const next = PLAYBACK_RATES[index + 1]
  if (next === undefined) return PLAYBACK_RATES[0]
  return next
}

export function nextSleepMinutes(current: SleepMinutes | null): SleepMinutes | null {
  if (current === null) return SLEEP_CHOICES[0]
  const index = SLEEP_CHOICES.indexOf(current)
  const next = SLEEP_CHOICES[index + 1]
  if (next === undefined) return null
  return next
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

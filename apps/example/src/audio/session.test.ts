import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  LOAD_ERROR_MESSAGE,
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
  nextFollowedVerse,
  nextListening,
  openDrawer,
  pressToolbar,
  showNarratorSelector,
  sleepDeadline,
  sleepLabels,
  sleepShouldPause,
  speedLabels,
  toolbarIcon,
  toolbarShowsPlayButton,
  verseAtTime,
  verseStartSeconds,
} from './session.ts'

const timings = [
  { verse: 1, startSeconds: 0, endSeconds: 8 },
  { verse: 3, startSeconds: 14, endSeconds: 22 },
] as const

test('verseAtTime returns the verse whose window contains the second', () => {
  assert.equal(verseAtTime(timings, 0), 1)
  assert.equal(verseAtTime(timings, 14), 3)
  assert.equal(verseAtTime(timings, 8), null)
  assert.equal(verseAtTime(timings, 22), null)
})

test('nextFollowedVerse reports a verse only when the window changes', () => {
  assert.equal(nextFollowedVerse(timings, 0, null), 1)
  assert.equal(nextFollowedVerse(timings, 1, 1), null)
  assert.equal(nextFollowedVerse(timings, 14, 1), 3)
  assert.equal(nextFollowedVerse(timings, 8, 1), null)
  assert.equal(nextFollowedVerse(timings, 22, 3), null)
  assert.equal(nextFollowedVerse(timings, 0, 3), 1)
})

test('verseStartSeconds returns that verse window start', () => {
  assert.equal(verseStartSeconds(timings, 1), 0)
  assert.equal(verseStartSeconds(timings, 3), 14)
  assert.equal(verseStartSeconds(timings, 2), null)
})

test('clock labels use elapsed minutes and a leading minus for time left', () => {
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(82), '1:22')
  assert.equal(formatClock(-4), '0:00')
  assert.equal(formatRemaining(82, 170), '-1:28')
  assert.equal(formatRemaining(0, 0), '-0:00')
})

test('skip clamps to the track', () => {
  assert.equal(clampSeconds(10 - 15, 100), 0)
  assert.equal(clampSeconds(90 + 15, 100), 100)
  assert.equal(clampSeconds(40 + 15, 100), 55)
})

test('speed choices run from 0.75x to 2x and 1x is the plain label', () => {
  assert.deepEqual(speedLabels(), ['0.75x', '1x', '1.25x', '1.5x', '1.75x', '2x'])
  assert.equal(formatRate(1), '1x')
  assert.equal(formatRate(0.75), '0.75x')
  assert.equal(formatRate(2), '2x')
})

test('sleep choices are Off, 5m, 10m, 15m, 30m, 1h, and 2h', () => {
  assert.deepEqual(sleepLabels(), ['Off', '5m', '10m', '15m', '30m', '1h', '2h'])
  assert.equal(formatSleep(null), 'Off')
  assert.equal(formatSleep(10), '10m')
  assert.equal(formatSleep(60), '1h')
  assert.equal(formatSleep(120), '2h')
  assert.equal(sleepDeadline(1_000, 120), 7_201_000)
  assert.equal(sleepShouldPause(7_201_000, 7_201_000), true)
  assert.equal(sleepShouldPause(7_200_999, 7_201_000), false)
  assert.equal(sleepShouldPause(7_201_000, null), false)
})

test('the reader version 3034 is labeled BSB, and an unknown id stays numeric', () => {
  assert.equal(labelForVersion(3034), 'BSB')
  assert.equal(labelForVersion(111), '111')
})

test('the narrator sheet appears only when more than one recording exists', () => {
  assert.equal(showNarratorSelector([]), false)
  assert.equal(showNarratorSelector([{ id: 'only', title: 'Only voice' }]), false)
  assert.equal(
    showNarratorSelector([
      { id: 'a', title: 'BSB Reader' },
      { id: 'b', title: 'BSB Dramatized' },
    ]),
    true,
  )
  assert.equal(narratorHeading('BSB'), 'Viewing Audio Bibles for BSB')
})

test('hiding the floating play button removes it, and the pill can still open the drawer', () => {
  assert.equal(toolbarShowsPlayButton(false), true)
  assert.equal(toolbarShowsPlayButton(true), false)
  const idle = { kind: 'idle' } as const
  assert.deepEqual(openDrawer(idle), { kind: 'session', drawer: 'open', transport: 'paused' })
  const playing = { kind: 'session', drawer: 'closed', transport: 'playing' } as const
  assert.deepEqual(openDrawer(playing), { kind: 'session', drawer: 'open', transport: 'playing' })
})

test('a stream that never loads becomes an error instead of staying on loading', () => {
  const loading = { kind: 'loading' } as const
  assert.deepEqual(loadPhaseAfterWait(loading, false, 7_999, false), loading)
  assert.deepEqual(loadPhaseAfterWait(loading, false, 8_000, false), {
    kind: 'error',
    message: LOAD_ERROR_MESSAGE,
  })
  assert.deepEqual(loadPhaseAfterWait(loading, true, 0, false), { kind: 'ready' })
  const ready = { kind: 'ready' } as const
  assert.deepEqual(loadPhaseAfterWait(ready, false, 9_000, false), ready)
  assert.deepEqual(loadPhaseAfterWait(ready, true, 0, true), {
    kind: 'error',
    message: LOAD_ERROR_MESSAGE,
  })
  const errored = { kind: 'error', message: LOAD_ERROR_MESSAGE } as const
  assert.deepEqual(loadPhaseAfterWait(errored, true, 0, false), { kind: 'ready' })
  assert.deepEqual(loadPhaseAfterWait(errored, false, 0, false), errored)
})

test('the first play opens the drawer, and collapsing it keeps playback going', () => {
  const idle = { kind: 'idle' } as const
  assert.equal(toolbarIcon(idle), 'play')
  assert.equal(drawerIsOpen(idle), false)

  const opened = pressToolbar(idle)
  assert.deepEqual(opened, { kind: 'session', drawer: 'open', transport: 'playing' })
  assert.equal(toolbarIcon(opened), 'pause')
  assert.equal(drawerIsOpen(opened), true)

  const collapsed = collapseDrawer(opened)
  assert.deepEqual(collapsed, { kind: 'session', drawer: 'closed', transport: 'playing' })
  assert.equal(toolbarIcon(collapsed), 'pause')
  assert.equal(drawerIsOpen(collapsed), false)

  const paused = pressToolbar(collapsed)
  assert.deepEqual(paused, { kind: 'session', drawer: 'closed', transport: 'paused' })
  assert.equal(toolbarIcon(paused), 'play')
})

test('chapter changes stay inside the sample list and open on Hebrews 11', () => {
  assert.equal(chapterAt(1).chapter, 11)
  assert.equal(chapterAt(-1).chapter, 10)
  assert.equal(chapterAt(99).chapter, 12)
  assert.equal(nextChapterIndex(0, 3, -1), 0)
  assert.equal(nextChapterIndex(1, 3, 1), 2)
  assert.equal(nextChapterIndex(2, 3, 1), 2)
})

const playing = { kind: 'session', drawer: 'open', transport: 'playing' } as const
const paused = { kind: 'session', drawer: 'open', transport: 'paused' } as const
const idle = { kind: 'idle' } as const

test('a playing track advances once when it finishes and pauses on the last chapter', () => {
  const advanced = nextListening(
    { didJustFinish: true, failed: false, finishConsumed: false },
    { chapterIndex: 1, chrome: playing },
    3,
  )
  assert.equal(advanced.listening.chapterIndex, 2)
  assert.deepEqual(advanced.listening.chrome, playing)
  assert.equal(advanced.finishConsumed, true)
  assert.equal(advanced.load, true)

  const repeated = nextListening(
    { didJustFinish: true, failed: false, finishConsumed: advanced.finishConsumed },
    { chapterIndex: advanced.listening.chapterIndex, chrome: advanced.listening.chrome },
    3,
  )
  assert.equal(repeated.listening.chapterIndex, 2)
  assert.equal(repeated.load, false)
  assert.equal(repeated.finishConsumed, true)
  assert.deepEqual(repeated.listening.chrome, playing)

  const ended = nextListening(
    { didJustFinish: true, failed: false, finishConsumed: false },
    { chapterIndex: 2, chrome: { kind: 'session', drawer: 'closed', transport: 'playing' } },
    3,
  )
  assert.equal(ended.listening.chapterIndex, 2)
  assert.deepEqual(ended.listening.chrome, {
    kind: 'session',
    drawer: 'closed',
    transport: 'paused',
  })
  assert.equal(ended.finishConsumed, true)
  assert.equal(ended.load, false)

  const fromStart = nextListening(
    { didJustFinish: true, failed: false, finishConsumed: false },
    { chapterIndex: 0, chrome: playing },
    3,
  )
  assert.equal(fromStart.listening.chapterIndex, 1)
  assert.equal(fromStart.load, true)
  assert.deepEqual(fromStart.listening.chrome, playing)
})

test('finish and failure leave a paused, failed, or idle player on the same chapter', () => {
  const alreadyPaused = nextListening(
    { didJustFinish: true, failed: false, finishConsumed: false },
    { chapterIndex: 1, chrome: paused },
    3,
  )
  assert.equal(alreadyPaused.listening.chapterIndex, 1)
  assert.deepEqual(alreadyPaused.listening.chrome, paused)
  assert.equal(alreadyPaused.load, false)
  assert.equal(alreadyPaused.finishConsumed, true)

  const failedAtEnd = nextListening(
    { didJustFinish: true, failed: true, finishConsumed: false },
    { chapterIndex: 1, chrome: playing },
    3,
  )
  assert.equal(failedAtEnd.listening.chapterIndex, 1)
  assert.deepEqual(failedAtEnd.listening.chrome, paused)
  assert.equal(failedAtEnd.load, false)
  assert.equal(failedAtEnd.finishConsumed, true)

  const failedWhilePlaying = nextListening(
    { didJustFinish: false, failed: true, finishConsumed: false },
    { chapterIndex: 1, chrome: playing },
    3,
  )
  assert.equal(failedWhilePlaying.listening.chapterIndex, 1)
  assert.deepEqual(failedWhilePlaying.listening.chrome, paused)
  assert.equal(failedWhilePlaying.load, false)
  assert.equal(failedWhilePlaying.finishConsumed, false)

  const finishedIdle = nextListening(
    { didJustFinish: true, failed: false, finishConsumed: false },
    { chapterIndex: 1, chrome: idle },
    3,
  )
  assert.equal(finishedIdle.listening.chapterIndex, 1)
  assert.deepEqual(finishedIdle.listening.chrome, idle)
  assert.equal(finishedIdle.load, false)
  assert.equal(finishedIdle.finishConsumed, true)

  const cleared = nextListening(
    { didJustFinish: false, failed: false, finishConsumed: true },
    { chapterIndex: 1, chrome: playing },
    3,
  )
  assert.equal(cleared.finishConsumed, false)
  assert.equal(cleared.load, false)
  assert.equal(cleared.listening.chapterIndex, 1)
  assert.deepEqual(cleared.listening.chrome, playing)
})

test('Hebrews 11 uses forty even windows and the neighboring chapters stay short', () => {
  const hebrews11 = chapterAt(1)
  assert.equal(hebrews11.chapter, 11)
  assert.equal(hebrews11.uri, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3')
  assert.equal(hebrews11.mockVerseTimings.length, 40)
  for (const [index, timing] of hebrews11.mockVerseTimings.entries()) {
    assert.equal(timing.verse, index + 1)
    assert.equal(timing.startSeconds, index * 10)
    assert.equal(timing.endSeconds, (index + 1) * 10)
  }
  assert.equal(verseAtTime(hebrews11.mockVerseTimings, 0), 1)
  assert.equal(verseAtTime(hebrews11.mockVerseTimings, 10), 2)
  assert.equal(verseAtTime(hebrews11.mockVerseTimings, 390), 40)
  assert.equal(verseAtTime(hebrews11.mockVerseTimings, 400), null)
  assert.equal(chapterAt(0).mockVerseTimings.length, 2)
  assert.equal(chapterAt(2).mockVerseTimings.length, 2)
})

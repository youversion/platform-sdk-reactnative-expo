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
  loadPhaseAfterWait,
  nextChapterIndex,
  nextPlaybackRate,
  nextSleepMinutes,
  pressToolbar,
  sleepDeadline,
  sleepShouldPause,
  toolbarIcon,
  verseAtTime,
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

test('speed cycles from 1x through 2x and back to 0.75x', () => {
  assert.equal(formatRate(1), '1x')
  assert.equal(nextPlaybackRate(1), 1.25)
  assert.equal(nextPlaybackRate(2), 0.75)
  assert.equal(formatRate(0.75), '0.75x')
})

test('sleep timer cycles off, 5, 15, 30, 60, then off', () => {
  assert.equal(formatSleep(null), 'Off')
  assert.equal(nextSleepMinutes(null), 5)
  assert.equal(nextSleepMinutes(5), 15)
  assert.equal(nextSleepMinutes(60), null)
  assert.equal(formatSleep(15), '15m')
  assert.equal(sleepDeadline(1_000, 5), 301_000)
  assert.equal(sleepShouldPause(301_000, 301_000), true)
  assert.equal(sleepShouldPause(300_999, 301_000), false)
  assert.equal(sleepShouldPause(301_000, null), false)
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

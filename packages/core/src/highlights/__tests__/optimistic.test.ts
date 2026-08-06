import { deriveServerColors } from '../cache'
import { HIGHLIGHT_COLORS, isHighlightColor, type HighlightScope } from '../constants'

import {
  claim,
  collapseVerseRuns,
  createOptimisticState,
  createWriteToken,
  formatPassageId,
  normalizeVerseSelection,
  selectHighlights,
  selectMergedColors,
  selectVersesInColor,
  serverColorsEqual,
  serverUpdated,
  settle,
  shouldRetire,
  versesInRun,
  type OptimisticState,
} from '../optimistic'

// `optimistic.ts` is pure, but the round-trip assertions below reach for
// `deriveServerColors`, and importing `cache.ts` boots the real MMKV native
// module. Stub the storage boundary; nothing in this file touches it.
jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn(),
    getString: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => []),
  },
}))

const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const YELLOW = 'fffe00'
const GREEN = '5dff79'
const BLUE = '00d6ff'

function stateWith(serverColors: Record<number, string> = {}): OptimisticState {
  return createOptimisticState({ scope, userId: 'user-1', serverColors })
}

describe('the highlight palette', () => {
  // Pinning test: these five values are a company-wide standard shared with the
  // web SDK's HIGHLIGHT_COLORS. Changing them is a product decision, not a
  // refactor.
  it('pins the five company-standard swatches', () => {
    expect(HIGHLIGHT_COLORS).toEqual(['fffe00', '5dff79', '00d6ff', 'ffc66f', 'ff95ef'])
  })

  it('matches swatches case-insensitively and rejects everything else', () => {
    expect(isHighlightColor('FFFE00')).toBe(true)
    expect(isHighlightColor(YELLOW)).toBe(true)
    expect(isHighlightColor('ff0000')).toBe(false)
    expect(isHighlightColor('#fffe00')).toBe(false)
    expect(isHighlightColor('')).toBe(false)
  })
})

describe('claim', () => {
  it('paints an apply, stamps ownership, and drops a pending reconcile', () => {
    const token = createWriteToken('apply')
    const claimed = claim(stateWith({ 16: GREEN }), [16, 17], token, YELLOW)

    expect(claimed.overlay).toEqual({ 16: YELLOW, 17: YELLOW })
    expect(claimed.writeIntent.get(16)).toBe(token)
    expect(claimed.writeIntent.get(17)).toBe(token)
    expect(selectMergedColors(claimed)).toEqual({ 16: YELLOW, 17: YELLOW })
  })

  it('paints a remove as a null overlay entry that hides server truth', () => {
    const claimed = claim(
      stateWith({ 16: YELLOW, 17: GREEN }),
      [16],
      createWriteToken('remove'),
      null,
    )

    expect(claimed.overlay).toEqual({ 16: null })
    expect(selectMergedColors(claimed)).toEqual({ 17: GREEN })
  })

  it('supersedes a pending reconcile entry for the same verse', () => {
    const first = createWriteToken('apply')
    const claimed = claim(stateWith(), [16], first, YELLOW)
    const settled = settle(claimed, {
      token: first,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })
    expect(settled.reconcile.has(16)).toBe(true)

    const reclaimed = claim(settled, [16], createWriteToken('apply'), GREEN)
    expect(reclaimed.reconcile.has(16)).toBe(false)
  })

  it('returns the same state for an empty verse list', () => {
    const state = stateWith({ 16: YELLOW })
    expect(claim(state, [], createWriteToken('apply'), YELLOW)).toBe(state)
  })
})

describe('settle', () => {
  it('keeps paint for succeeded verses and registers them for reconciliation', () => {
    const token = createWriteToken('apply')
    const claimed = claim(stateWith(), [16, 17], token, YELLOW)

    const settled = settle(claimed, {
      token,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [16, 17],
      failedVerses: [],
    })

    expect(settled.overlay).toEqual({ 16: YELLOW, 17: YELLOW })
    expect(settled.reconcile.get(16)).toEqual({ op: 'apply', color: YELLOW })
    // Settled writes release their claim so intents cannot accumulate.
    expect(settled.writeIntent.size).toBe(0)
  })

  it('reverts paint for failed verses', () => {
    const token = createWriteToken('apply')
    const claimed = claim(stateWith({ 16: GREEN }), [16], token, YELLOW)

    const settled = settle(claimed, {
      token,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [],
      failedVerses: [16],
    })

    expect(settled.overlay).toEqual({})
    expect(selectMergedColors(settled)).toEqual({ 16: GREEN })
  })

  it('restores the highlight when a remove fails', () => {
    const token = createWriteToken('remove')
    const claimed = claim(stateWith({ 16: YELLOW }), [16], token, null)
    expect(selectMergedColors(claimed)).toEqual({})

    const settled = settle(claimed, {
      token,
      op: 'remove',
      color: YELLOW,
      succeededVerses: [],
      failedVerses: [16],
    })

    expect(selectMergedColors(settled)).toEqual({ 16: YELLOW })
  })

  it('splits a partial batch: succeeded verses hold, failed verses revert', () => {
    const token = createWriteToken('apply')
    const claimed = claim(stateWith(), [16, 20], token, YELLOW)

    const settled = settle(claimed, {
      token,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [20],
    })

    expect(selectMergedColors(settled)).toEqual({ 16: YELLOW })
    expect(settled.reconcile.get(16)).toEqual({ op: 'apply', color: YELLOW })
    expect(settled.reconcile.has(20)).toBe(false)
  })

  // AC 4 — the ownership token. This is the whole reason writeIntent exists.
  it('does not clobber a newer claim when an older write fails (ownership token)', () => {
    const yellowToken = createWriteToken('apply')
    const greenToken = createWriteToken('apply')

    // Tap yellow on 16, then tap green on 16 before yellow's POST returns.
    let state = claim(stateWith(), [16], yellowToken, YELLOW)
    state = claim(state, [16], greenToken, GREEN)
    expect(selectMergedColors(state)).toEqual({ 16: GREEN })

    // Now yellow's POST fails. It no longer owns verse 16.
    const settled = settle(state, {
      token: yellowToken,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [],
      failedVerses: [16],
    })

    expect(selectMergedColors(settled)).toEqual({ 16: GREEN })
    expect(settled.writeIntent.get(16)).toBe(greenToken)
    // Nothing this op owned, so the state object is untouched.
    expect(settled).toBe(state)
  })

  it('does not register a reconcile entry for a verse it no longer owns', () => {
    const first = createWriteToken('apply')
    const second = createWriteToken('apply')
    let state = claim(stateWith(), [16], first, YELLOW)
    state = claim(state, [16], second, GREEN)

    const settled = settle(state, {
      token: first,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })

    expect(settled.reconcile.has(16)).toBe(false)
    expect(settled.writeIntent.get(16)).toBe(second)
  })
})

describe('reset (createOptimisticState)', () => {
  it('clears overlay, reconcile and write intents, and re-seeds identity', () => {
    const applyToken = createWriteToken('apply')
    const pending = createWriteToken('apply')
    let state = settle(claim(stateWith(), [16], applyToken, YELLOW), {
      token: applyToken,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })
    // A second write is still in flight when the user navigates away.
    state = claim(state, [20], pending, GREEN)
    expect(state.reconcile.size).toBe(1)
    expect(state.writeIntent.size).toBe(1)

    const nextScope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '4' }
    const reset = createOptimisticState({
      scope: nextScope,
      userId: 'user-2',
      serverColors: { 1: BLUE },
    })

    expect(reset.scope).toEqual(nextScope)
    expect(reset.userId).toBe('user-2')
    expect(reset.overlay).toEqual({})
    expect(reset.reconcile.size).toBe(0)
    // Clearing writeIntent is what stops the in-flight write from settling onto
    // a colliding verse number in the new scope.
    expect(reset.writeIntent.size).toBe(0)
    expect(
      settle(reset, {
        token: pending,
        op: 'apply',
        color: GREEN,
        succeededVerses: [20],
        failedVerses: [],
      }),
    ).toBe(reset)
  })
})

describe('serverUpdated', () => {
  it('retires an apply overlay once the server reports the written color', () => {
    const token = createWriteToken('apply')
    const claimed = claim(stateWith(), [16], token, YELLOW)
    const settled = settle(claimed, {
      token,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })

    const reconciled = serverUpdated(settled, { 16: YELLOW })

    expect(reconciled.overlay).toEqual({})
    expect(reconciled.reconcile.size).toBe(0)
    expect(selectMergedColors(reconciled)).toEqual({ 16: YELLOW })
  })

  it('holds an apply overlay while the server still reports the old color', () => {
    const token = createWriteToken('apply')
    const settled = settle(claim(stateWith({ 16: GREEN }), [16], token, YELLOW), {
      token,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })

    const reconciled = serverUpdated(settled, { 16: GREEN })

    expect(reconciled.overlay).toEqual({ 16: YELLOW })
    expect(selectMergedColors(reconciled)).toEqual({ 16: YELLOW })
  })

  // AC 5 — the vapor fix. A stale read replica echoing the color we just
  // deleted must not resurrect the highlight.
  it('never resurrects a removed verse when a stale fetch echoes the deleted color', () => {
    const token = createWriteToken('remove')
    const settled = settle(claim(stateWith({ 16: YELLOW }), [16], token, null), {
      token,
      op: 'remove',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })

    // The replica has not caught up: it still reports the yellow we deleted.
    const reconciled = serverUpdated(settled, { 16: YELLOW })

    expect(reconciled.overlay).toEqual({ 16: null })
    expect(selectMergedColors(reconciled)).toEqual({})
    // Still held — a later fetch gets another chance to confirm it.
    expect(reconciled.reconcile.has(16)).toBe(true)
  })

  // The other half of the color-aware retirement pair: our deliberate
  // divergence from web, which would suppress this repaint indefinitely.
  it('retires a remove overlay when the server reports a DIFFERENT color', () => {
    const token = createWriteToken('remove')
    const settled = settle(claim(stateWith({ 16: YELLOW }), [16], token, null), {
      token,
      op: 'remove',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })

    // Another device set green on this verse after our delete landed. A green
    // echo cannot be vapor from deleting yellow, so it is newer data.
    const reconciled = serverUpdated(settled, { 16: GREEN })

    expect(reconciled.overlay).toEqual({})
    expect(selectMergedColors(reconciled)).toEqual({ 16: GREEN })
  })

  it('retires a remove overlay once the verse is genuinely gone server-side', () => {
    const token = createWriteToken('remove')
    const settled = settle(claim(stateWith({ 16: YELLOW }), [16], token, null), {
      token,
      op: 'remove',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })

    // The plan's rule holds the overlay while the deleted color is echoed; an
    // absent verse is not an echo, but it also is not "a different color" — the
    // overlay stays until the server stops lying, and the rendered result is
    // identical either way.
    const reconciled = serverUpdated(settled, {})
    expect(selectMergedColors(reconciled)).toEqual({})
  })

  it('returns the same object when nothing changed (bridge stability)', () => {
    const state = stateWith({ 16: YELLOW })
    expect(serverUpdated(state, { 16: YELLOW })).toBe(state)
  })

  it('returns a new object when server colors change', () => {
    const state = stateWith({ 16: YELLOW })
    const next = serverUpdated(state, { 16: GREEN })
    expect(next).not.toBe(state)
    expect(next.serverColors).toEqual({ 16: GREEN })
  })

  it('keeps holding entries that did not retire while retiring the ones that did', () => {
    const applyToken = createWriteToken('apply')
    const removeToken = createWriteToken('remove')
    let state = stateWith({ 20: BLUE })
    state = settle(claim(state, [16], applyToken, YELLOW), {
      token: applyToken,
      op: 'apply',
      color: YELLOW,
      succeededVerses: [16],
      failedVerses: [],
    })
    state = settle(claim(state, [20], removeToken, null), {
      token: removeToken,
      op: 'remove',
      color: BLUE,
      succeededVerses: [20],
      failedVerses: [],
    })

    const reconciled = serverUpdated(state, { 16: YELLOW, 20: BLUE })

    expect(reconciled.reconcile.has(16)).toBe(false) // apply confirmed
    expect(reconciled.reconcile.has(20)).toBe(true) // remove echo held
    expect(selectMergedColors(reconciled)).toEqual({ 16: YELLOW })
  })
})

describe('shouldRetire', () => {
  it('retires an apply only on an exact color match', () => {
    expect(shouldRetire({ op: 'apply', color: YELLOW }, YELLOW)).toBe(true)
    expect(shouldRetire({ op: 'apply', color: YELLOW }, GREEN)).toBe(false)
    expect(shouldRetire({ op: 'apply', color: YELLOW }, undefined)).toBe(false)
  })

  it('retires a remove only on a different, present color', () => {
    expect(shouldRetire({ op: 'remove', color: YELLOW }, YELLOW)).toBe(false) // vapor
    expect(shouldRetire({ op: 'remove', color: YELLOW }, GREEN)).toBe(true)
    expect(shouldRetire({ op: 'remove', color: YELLOW }, undefined)).toBe(false)
  })
})

describe('serverColorsEqual', () => {
  it('compares by content, not identity', () => {
    expect(serverColorsEqual({ 16: YELLOW }, { 16: YELLOW })).toBe(true)
    expect(serverColorsEqual({}, {})).toBe(true)
    expect(serverColorsEqual({ 16: YELLOW }, { 16: GREEN })).toBe(false)
    expect(serverColorsEqual({ 16: YELLOW }, { 16: YELLOW, 17: GREEN })).toBe(false)
    expect(serverColorsEqual({ 16: YELLOW, 17: GREEN }, { 16: YELLOW })).toBe(false)
    expect(serverColorsEqual({ 16: YELLOW }, { 17: YELLOW })).toBe(false)
  })
})

describe('selectHighlights', () => {
  it('emits one per-verse highlight, ascending', () => {
    const state = claim(stateWith({ 20: BLUE }), [16, 17], createWriteToken('apply'), YELLOW)

    expect(selectHighlights(state)).toEqual([
      { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW },
      { version_id: 111, passage_id: 'JHN.3.17', color: YELLOW },
      { version_id: 111, passage_id: 'JHN.3.20', color: BLUE },
    ])
  })

  it('omits verses the overlay removed', () => {
    const state = claim(
      stateWith({ 16: YELLOW, 17: GREEN }),
      [16],
      createWriteToken('remove'),
      null,
    )
    expect(selectHighlights(state)).toEqual([
      { version_id: 111, passage_id: 'JHN.3.17', color: GREEN },
    ])
  })

  it('round-trips exactly through deriveServerColors', () => {
    const state = claim(stateWith({ 20: BLUE }), [16, 17], createWriteToken('apply'), YELLOW)
    expect(deriveServerColors(selectHighlights(state), scope)).toEqual(selectMergedColors(state))
  })

  // Defensive contract test, NOT a production path: the API stores highlights
  // per verse and only accepts ranges on the wire, so a GET never echoes a
  // range. This guards `expandPassageId` in case that ever changes.
  it('splits a range that arrives in server truth into its verses', () => {
    const fromRange = deriveServerColors(
      [{ version_id: 111, passage_id: 'JHN.3.16-18', color: YELLOW }],
      scope,
    )
    const state = claim(
      createOptimisticState({ scope, userId: 'user-1', serverColors: fromRange }),
      [17],
      createWriteToken('remove'),
      null,
    )

    expect(selectHighlights(state)).toEqual([
      { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW },
      { version_id: 111, passage_id: 'JHN.3.18', color: YELLOW },
    ])
  })
})

describe('selectVersesInColor', () => {
  it('targets only verses the user currently sees in that color', () => {
    const state = stateWith({ 16: YELLOW, 17: BLUE, 18: YELLOW })
    expect(selectVersesInColor(state, [16, 17, 18, 19], YELLOW)).toEqual([16, 18])
  })

  it('counts optimistic paint, not just server truth', () => {
    const state = claim(stateWith({ 16: BLUE }), [16], createWriteToken('apply'), YELLOW)
    expect(selectVersesInColor(state, [16], YELLOW)).toEqual([16])
    expect(selectVersesInColor(state, [16], BLUE)).toEqual([])
  })

  it('ignores verses an optimistic remove has already hidden', () => {
    const state = claim(stateWith({ 16: YELLOW }), [16], createWriteToken('remove'), null)
    expect(selectVersesInColor(state, [16], YELLOW)).toEqual([])
  })
})

describe('USFM range helpers', () => {
  it('collapses verses into contiguous runs, de-duped and sorted', () => {
    expect(collapseVerseRuns([16, 17, 18])).toEqual([{ start: 16, end: 18 }])
    expect(collapseVerseRuns([4, 1, 3])).toEqual([
      { start: 1, end: 1 },
      { start: 3, end: 4 },
    ])
    expect(collapseVerseRuns([5, 5, 5])).toEqual([{ start: 5, end: 5 }])
    expect(collapseVerseRuns([])).toEqual([])
  })

  it('drops non-positive and non-integer verse numbers', () => {
    expect(collapseVerseRuns([0, -1, 2, 3.5])).toEqual([{ start: 2, end: 2 }])
  })

  it('formats a run as a range USFM, collapsing single verses', () => {
    expect(formatPassageId('JHN', '3', { start: 16, end: 18 })).toBe('JHN.3.16-18')
    expect(formatPassageId('JHN', '3', { start: 5, end: 5 })).toBe('JHN.3.5')
  })

  it('expands a run back into its verses', () => {
    expect(versesInRun({ start: 2, end: 4 })).toEqual([2, 3, 4])
    expect(versesInRun({ start: 7, end: 7 })).toEqual([7])
  })

  it('normalizes a verse list through the same run machinery', () => {
    expect(normalizeVerseSelection([18, 16, 16, 0, 17, 20])).toEqual([16, 17, 18, 20])
    expect(normalizeVerseSelection([])).toEqual([])
  })
})

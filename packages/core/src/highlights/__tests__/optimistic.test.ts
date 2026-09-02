import { deriveServerColors } from '../cache'
import {
  HIGHLIGHT_COLORS,
  isHighlightColor,
  type HighlightScope,
  type QueuedWrites,
} from '../constants'

import {
  collapseVerseRuns,
  confirm,
  createOptimisticState,
  formatPassageId,
  normalizeVerseSelection,
  paint,
  restore,
  selectHighlights,
  selectVersesInColor,
  serverColorsEqual,
  serverUpdated,
  shouldRetire,
  versesInRun,
  type OptimisticState,
} from '../optimistic'

const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const YELLOW = 'fffe00'
const GREEN = '5dff79'
const BLUE = '00d6ff'

const NO_QUEUE: QueuedWrites = {}

function stateWith(colors: Record<number, string> = {}): OptimisticState {
  return createOptimisticState({ scope, userId: 'user-1', colors })
}

describe('the highlight palette', () => {
  // Pinning test: these six values are a company-wide standard shared with the
  // web SDK's HIGHLIGHT_COLORS (YPE-5058). Changing them is a product decision,
  // not a refactor.
  it('pins the six company-standard apply swatches', () => {
    expect(HIGHLIGHT_COLORS).toEqual(['ffec5b', 'b4ffc1', 'bbf4ff', 'ffdca7', 'ffcff8', 'dfdcff'])
  })

  it('matches swatches case-insensitively and rejects everything else', () => {
    expect(isHighlightColor('FFEC5B')).toBe(true)
    expect(isHighlightColor('ffec5b')).toBe(true)
    expect(isHighlightColor('ff0000')).toBe(false)
    expect(isHighlightColor('#ffec5b')).toBe(false)
    expect(isHighlightColor('')).toBe(false)
  })

  it('rejects the old five apply hexes', () => {
    expect(isHighlightColor('fffe00')).toBe(false)
    expect(isHighlightColor('5dff79')).toBe(false)
    expect(isHighlightColor('00d6ff')).toBe(false)
    expect(isHighlightColor('ffc66f')).toBe(false)
    expect(isHighlightColor('ff95ef')).toBe(false)
  })
})

describe('paint', () => {
  it('paints an apply over whatever was there', () => {
    expect(paint(stateWith({ 16: GREEN }), [16, 17], YELLOW).colors).toEqual({
      16: YELLOW,
      17: YELLOW,
    })
  })

  it('paints a remove as an absence', () => {
    expect(paint(stateWith({ 16: YELLOW, 17: GREEN }), [16], null).colors).toEqual({ 17: GREEN })
  })

  it('supersedes a pending reconcile entry for the same verse', () => {
    const confirmed = confirm(paint(stateWith(), [16], YELLOW), {
      op: 'apply',
      color: YELLOW,
      verses: [16],
    })
    expect(confirmed.reconcile.has(16)).toBe(true)

    expect(paint(confirmed, [16], GREEN).reconcile.has(16)).toBe(false)
  })

  it('returns the same state for an empty verse list', () => {
    const state = stateWith({ 16: YELLOW })
    expect(paint(state, [], YELLOW)).toBe(state)
  })
})

describe('confirm', () => {
  it('registers accepted verses for reconciliation without touching the paint', () => {
    const painted = paint(stateWith(), [16, 17], YELLOW)
    const confirmed = confirm(painted, { op: 'apply', color: YELLOW, verses: [16, 17] })

    expect(confirmed.colors).toEqual({ 16: YELLOW, 17: YELLOW })
    expect(confirmed.reconcile.get(16)).toEqual({ op: 'apply', color: YELLOW })
  })

  it('returns the same state for an empty verse list', () => {
    const state = stateWith({ 16: YELLOW })
    expect(confirm(state, { op: 'apply', color: YELLOW, verses: [] })).toBe(state)
  })
})

describe('restore', () => {
  it('puts back the color the server had', () => {
    const painted = paint(stateWith({ 16: GREEN }), [16], YELLOW)
    expect(restore(painted, { restored: { 16: GREEN }, cleared: [] }).colors).toEqual({ 16: GREEN })
  })

  it('un-paints a verse the server had nothing for', () => {
    const painted = paint(stateWith(), [16], YELLOW)
    expect(restore(painted, { restored: {}, cleared: [16] }).colors).toEqual({})
  })

  it('restores the highlight a failed remove hid', () => {
    const painted = paint(stateWith({ 16: YELLOW }), [16], null)
    expect(painted.colors).toEqual({})
    expect(restore(painted, { restored: { 16: YELLOW }, cleared: [] }).colors).toEqual({
      16: YELLOW,
    })
  })

  it('returns the same state when there is nothing to put back', () => {
    const state = stateWith({ 16: YELLOW })
    expect(restore(state, { restored: {}, cleared: [] })).toBe(state)
    expect(restore(state, { restored: { 16: YELLOW }, cleared: [] })).toBe(state)
  })
})

describe('reset (createOptimisticState)', () => {
  it('clears reconciliation and re-seeds identity', () => {
    const state = confirm(paint(stateWith(), [16], YELLOW), {
      op: 'apply',
      color: YELLOW,
      verses: [16],
    })
    expect(state.reconcile.size).toBe(1)

    const nextScope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '4' }
    const reset = createOptimisticState({
      scope: nextScope,
      userId: 'user-2',
      colors: { 1: BLUE },
    })

    expect(reset.scope).toEqual(nextScope)
    expect(reset.userId).toBe('user-2')
    expect(reset.colors).toEqual({ 1: BLUE })
    expect(reset.reconcile.size).toBe(0)
  })
})

describe('serverUpdated', () => {
  it('retires a confirmed apply once the server reports the written color', () => {
    const state = confirm(paint(stateWith(), [16], YELLOW), {
      op: 'apply',
      color: YELLOW,
      verses: [16],
    })

    const reconciled = serverUpdated(state, { 16: YELLOW }, NO_QUEUE)

    expect(reconciled.reconcile.size).toBe(0)
    expect(reconciled.colors).toEqual({ 16: YELLOW })
  })

  it('holds a confirmed apply while the server still reports the old color', () => {
    const state = confirm(paint(stateWith({ 16: GREEN }), [16], YELLOW), {
      op: 'apply',
      color: YELLOW,
      verses: [16],
    })

    expect(serverUpdated(state, { 16: GREEN }, NO_QUEUE).colors).toEqual({ 16: YELLOW })
  })

  // AC 5 — the vapor fix. A stale read replica echoing the color we just
  // deleted must not resurrect the highlight.
  it('never resurrects a removed verse when a stale fetch echoes the deleted color', () => {
    const state = confirm(paint(stateWith({ 16: YELLOW }), [16], null), {
      op: 'remove',
      color: YELLOW,
      verses: [16],
    })

    // The replica has not caught up: it still reports the yellow we deleted.
    const reconciled = serverUpdated(state, { 16: YELLOW }, NO_QUEUE)

    expect(reconciled.colors).toEqual({})
    // Still held — a later fetch gets another chance to confirm it.
    expect(reconciled.reconcile.has(16)).toBe(true)
  })

  // The other half of the color-aware retirement pair: our deliberate
  // divergence from web, which would suppress this repaint indefinitely.
  it('retires a confirmed remove when the server reports a DIFFERENT color', () => {
    const state = confirm(paint(stateWith({ 16: YELLOW }), [16], null), {
      op: 'remove',
      color: YELLOW,
      verses: [16],
    })

    // Another device set green on this verse after our delete landed. A green
    // echo cannot be vapor from deleting yellow, so it is newer data.
    const reconciled = serverUpdated(state, { 16: GREEN }, NO_QUEUE)

    expect(reconciled.colors).toEqual({ 16: GREEN })
    expect(reconciled.reconcile.has(16)).toBe(false)
  })

  it('paints nothing once the verse is genuinely gone server-side', () => {
    const state = confirm(paint(stateWith({ 16: YELLOW }), [16], null), {
      op: 'remove',
      color: YELLOW,
      verses: [16],
    })

    // The rule holds the entry while the deleted color is echoed; an absent
    // verse is not an echo, but it also is not "a different color" — the entry
    // stays until the server stops lying, and the paint is identical either way.
    expect(serverUpdated(state, {}, NO_QUEUE).colors).toEqual({})
  })

  it('re-applies unsent writes over fresh server truth', () => {
    const state = stateWith({ 16: YELLOW })
    const queued: QueuedWrites = {
      16: { local: GREEN, server: YELLOW },
      20: { local: null, server: BLUE },
    }

    expect(serverUpdated(state, { 16: YELLOW, 20: BLUE }, queued).colors).toEqual({ 16: GREEN })
  })

  it('lets an unsent write win over a confirmed one for the same verse', () => {
    const state = confirm(paint(stateWith(), [16], YELLOW), {
      op: 'apply',
      color: YELLOW,
      verses: [16],
    })
    const queued: QueuedWrites = { 16: { local: GREEN, server: YELLOW } }

    expect(serverUpdated(state, {}, queued).colors).toEqual({ 16: GREEN })
  })

  it('returns the same object when nothing changed (bridge stability)', () => {
    const state = stateWith({ 16: YELLOW })
    expect(serverUpdated(state, { 16: YELLOW }, NO_QUEUE)).toBe(state)
  })

  it('returns a new object when server colors change', () => {
    const state = stateWith({ 16: YELLOW })
    const next = serverUpdated(state, { 16: GREEN }, NO_QUEUE)
    expect(next).not.toBe(state)
    expect(next.colors).toEqual({ 16: GREEN })
  })

  it('keeps holding entries that did not retire while retiring the ones that did', () => {
    let state = stateWith({ 20: BLUE })
    state = confirm(paint(state, [16], YELLOW), { op: 'apply', color: YELLOW, verses: [16] })
    state = confirm(paint(state, [20], null), { op: 'remove', color: BLUE, verses: [20] })

    const reconciled = serverUpdated(state, { 16: YELLOW, 20: BLUE }, NO_QUEUE)

    expect(reconciled.reconcile.has(16)).toBe(false) // apply confirmed
    expect(reconciled.reconcile.has(20)).toBe(true) // remove echo held
    expect(reconciled.colors).toEqual({ 16: YELLOW })
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
    const state = paint(stateWith({ 20: BLUE }), [16, 17], YELLOW)

    expect(selectHighlights(state)).toEqual([
      { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW },
      { version_id: 111, passage_id: 'JHN.3.17', color: YELLOW },
      { version_id: 111, passage_id: 'JHN.3.20', color: BLUE },
    ])
  })

  it('omits removed verses', () => {
    const state = paint(stateWith({ 16: YELLOW, 17: GREEN }), [16], null)
    expect(selectHighlights(state)).toEqual([
      { version_id: 111, passage_id: 'JHN.3.17', color: GREEN },
    ])
  })

  it('round-trips exactly through deriveServerColors', () => {
    const state = paint(stateWith({ 20: BLUE }), [16, 17], YELLOW)
    expect(deriveServerColors(selectHighlights(state), scope)).toEqual(state.colors)
  })

  // Defensive contract test, NOT a production path: the API stores highlights
  // per verse and only accepts ranges on the wire, so a GET never echoes a
  // range. This guards `expandPassageId` in case that ever changes.
  it('splits a range that arrives in server truth into its verses', () => {
    const fromRange = deriveServerColors(
      [{ version_id: 111, passage_id: 'JHN.3.16-18', color: YELLOW }],
      scope,
    )
    const state = paint(
      createOptimisticState({ scope, userId: 'user-1', colors: fromRange }),
      [17],
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
    const state = paint(stateWith({ 16: BLUE }), [16], YELLOW)
    expect(selectVersesInColor(state, [16], YELLOW)).toEqual([16])
    expect(selectVersesInColor(state, [16], BLUE)).toEqual([])
  })

  it('ignores verses an optimistic remove has already hidden', () => {
    const state = paint(stateWith({ 16: YELLOW }), [16], null)
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
    expect(collapseVerseRuns([0, -1, 1.5, 2])).toEqual([{ start: 2, end: 2 }])
  })

  it('formats a run as a range USFM, collapsing single verses', () => {
    expect(formatPassageId('JHN', '3', { start: 2, end: 3 })).toBe('JHN.3.2-3')
    expect(formatPassageId('JHN', '3', { start: 5, end: 5 })).toBe('JHN.3.5')
  })

  it('expands a run back into its verses', () => {
    expect(versesInRun({ start: 2, end: 4 })).toEqual([2, 3, 4])
    expect(versesInRun({ start: 7, end: 7 })).toEqual([7])
  })

  it('normalizes a verse list through the same run machinery', () => {
    expect(normalizeVerseSelection([18, 16, 17, 16, 0])).toEqual([16, 17, 18])
    expect(normalizeVerseSelection([])).toEqual([])
  })
})

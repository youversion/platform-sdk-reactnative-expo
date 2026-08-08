/**
 * Pure paint math for the native highlights layer. React-free and
 * side-effect-free: no storage, no network, no hooks.
 *
 * `colors` is what the reader shows — server truth with the user's unconfirmed
 * edits already folded in, not a base plus an overlay. The record of which edits
 * are unconfirmed lives in the Highlight Write Queue, which is persisted; this
 * module takes it as an argument at {@link serverUpdated} and never reads it
 * otherwise. See ADR 0013 and ADR 0017.
 *
 * Every transition returns the *same* object when nothing changed, because the
 * projected output crosses the native/DOM bridge as a serialized prop.
 */

import type { Highlight } from '@youversion/platform-core'
import type { HighlightScope, QueuedWrites, ServerColors } from './constants'

export type WriteOp = 'apply' | 'remove'

/**
 * A write the server accepted, held until a fetch agrees. Without it a read
 * replica one step behind repaints what was just deleted ("vapor").
 */
export type ReconcileEntry = { op: WriteOp; color: string }

export type OptimisticState = {
  scope: HighlightScope
  userId: string | null
  /** What the reader paints. */
  colors: ServerColors
  reconcile: ReadonlyMap<number, ReconcileEntry>
}

export function createOptimisticState(input: {
  scope: HighlightScope
  userId: string | null
  colors: ServerColors
}): OptimisticState {
  return {
    scope: input.scope,
    userId: input.userId,
    colors: input.colors,
    reconcile: new Map(),
  }
}

/**
 * Paints `verses` — a color for an apply, `null` for a remove — and drops any
 * reconciliation pending on them, which a newer write supersedes.
 */
export function paint(
  state: OptimisticState,
  verses: readonly number[],
  color: string | null,
): OptimisticState {
  if (verses.length === 0) {
    return state
  }
  const colors = { ...state.colors }
  const reconcile = new Map(state.reconcile)
  for (const verse of verses) {
    if (color === null) {
      delete colors[verse]
    } else {
      colors[verse] = color
    }
    reconcile.delete(verse)
  }
  return { ...state, colors, reconcile }
}

/**
 * Registers verses the server has accepted, so the next fetch knows when it is
 * safe to stop trusting the local value. Leaves the paint alone — it is already
 * what was written.
 */
export function confirm(
  state: OptimisticState,
  batch: { op: WriteOp; color: string; verses: readonly number[] },
): OptimisticState {
  if (batch.verses.length === 0) {
    return state
  }
  const reconcile = new Map(state.reconcile)
  for (const verse of batch.verses) {
    reconcile.set(verse, { op: batch.op, color: batch.color })
  }
  return { ...state, reconcile }
}

/**
 * Puts verses back to what the server had, for a write the server rejected. Two
 * halves because a verse the server had nothing for is an absence, not a color.
 */
export function restore(
  state: OptimisticState,
  batch: { restored: ServerColors; cleared: readonly number[] },
): OptimisticState {
  if (Object.keys(batch.restored).length === 0 && batch.cleared.length === 0) {
    return state
  }
  const colors = { ...state.colors }
  for (const [verse, color] of Object.entries(batch.restored)) {
    colors[Number(verse)] = color
  }
  for (const verse of batch.cleared) {
    delete colors[verse]
  }
  return serverColorsEqual(state.colors, colors) ? state : { ...state, colors }
}

/**
 * Decides whether a pending reconcile entry is confirmed by fresh server truth.
 *
 * **Deliberate divergence from web.** Web's `reconcileOverlay` never retires a
 * remove entry (`if (entry.op !== 'apply') continue`). That fixes the vapor bug,
 * but the suppression is unbounded: a *new* color set on another device stays
 * invisible until a reset path runs. `ReconcileEntry` already carries the color
 * and web simply ignores it for removes, so we can keep the fix and drop most of
 * the cost — a color that differs from the one we deleted cannot be an echo of
 * that deletion, it is newer data.
 *
 * Narrower failure mode this introduces: verse was green, user set yellow, user
 * removed it, and a replica stale enough to still report *green* retires the
 * entry and briefly paints green. That needs the server two steps behind rather
 * than one.
 *
 * Reverting to web's behavior is `return false` in the remove branch.
 */
export function shouldRetire(entry: ReconcileEntry, serverColor: string | undefined): boolean {
  if (entry.op === 'apply') {
    return serverColor === entry.color
  }
  return serverColor !== undefined && serverColor !== entry.color
}

/**
 * Rebuilds the paint from fresh server truth, re-applying everything not yet
 * confirmed: writes the server has accepted but may not be serving back yet
 * (`reconcile`), then writes it has not received at all (`queued`), which are
 * newer and win.
 *
 * Returns the same state object when the fetch changed nothing, so the projected
 * highlights prop stays referentially stable across the bridge.
 */
export function serverUpdated(
  state: OptimisticState,
  serverColors: ServerColors,
  queued: QueuedWrites,
): OptimisticState {
  const reconcile = new Map(state.reconcile)
  let retired = false
  for (const [verse, entry] of state.reconcile) {
    if (shouldRetire(entry, serverColors[verse])) {
      reconcile.delete(verse)
      retired = true
    }
  }

  const colors: ServerColors = { ...serverColors }
  for (const [verse, entry] of reconcile) {
    if (entry.op === 'apply') {
      colors[verse] = entry.color
    } else {
      delete colors[verse]
    }
  }
  applyQueuedWrites(colors, queued)

  const colorsChanged = !serverColorsEqual(state.colors, colors)
  if (!colorsChanged && !retired) {
    return state
  }
  return {
    ...state,
    colors: colorsChanged ? colors : state.colors,
    reconcile: retired ? reconcile : state.reconcile,
  }
}

/** Folds unsent writes onto `colors` in place. */
export function applyQueuedWrites(colors: ServerColors, queued: QueuedWrites): void {
  for (const [verse, entry] of Object.entries(queued)) {
    if (entry.local === null) {
      delete colors[Number(verse)]
    } else {
      colors[Number(verse)] = entry.local
    }
  }
}

export function serverColorsEqual(a: ServerColors, b: ServerColors): boolean {
  if (a === b) {
    return true
  }
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) {
    return false
  }
  for (const key of aKeys) {
    if (a[Number(key)] !== b[Number(key)]) {
      return false
    }
  }
  return true
}

// ── Selectors ────────────────────────────────────────────────────────────────

/**
 * The rendered state as one `Highlight` per verse, ascending. Per-verse (never
 * ranges) so that `deriveServerColors(selectHighlights(state), scope)` is an
 * exact round trip.
 */
export function selectHighlights(state: OptimisticState): Highlight[] {
  return highlightsFromColors(state.scope, state.colors)
}

/** The same projection for callers holding colors without a state (the cache). */
export function highlightsFromColors(scope: HighlightScope, colors: ServerColors): Highlight[] {
  const { versionId, book, chapter } = scope
  return Object.keys(colors)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((verse) => {
      const color = colors[verse]
      return color === undefined
        ? []
        : [{ version_id: versionId, passage_id: `${book}.${chapter}.${verse}`, color }]
    })
}

/**
 * Of `verses`, the ones the user currently *sees* in `color`. The remove path
 * targets what is on screen, not what the server last said, because a DELETE
 * carries a passage id and no color: removing yellow across a selection that
 * also holds a blue verse must not destroy the blue one.
 */
export function selectVersesInColor(
  state: OptimisticState,
  verses: readonly number[],
  color: string,
): number[] {
  return verses.filter((verse) => state.colors[verse] === color)
}

// ── USFM range helpers (ported from web's `usfm-ranges.ts`) ───────────────────

export type VerseRun = { start: number; end: number }

/**
 * Groups a verse list into contiguous ascending runs:
 * `[16,17,18] -> [{16,18}]`, `[1,3,4] -> [{1,1},{3,4}]`.
 * De-duplicates and sorts; non-positive verse numbers are dropped.
 */
export function collapseVerseRuns(verses: readonly number[]): VerseRun[] {
  const sorted = [...new Set(verses)].filter((verse) => Number.isInteger(verse) && verse > 0)
  sorted.sort((a, b) => a - b)
  const runs: VerseRun[] = []

  for (const verse of sorted) {
    const current = runs[runs.length - 1]
    if (current && verse === current.end + 1) {
      current.end = verse
    } else {
      runs.push({ start: verse, end: verse })
    }
  }

  return runs
}

/**
 * The range USFM for one contiguous run:
 * `("JHN", "3", {2,3}) -> "JHN.3.2-3"`, `("JHN", "3", {5,5}) -> "JHN.3.5"`.
 */
export function formatPassageId(book: string, chapter: string, run: VerseRun): string {
  return run.start === run.end
    ? `${book}.${chapter}.${run.start}`
    : `${book}.${chapter}.${run.start}-${run.end}`
}

/** Expands a contiguous run back into its verse numbers: `{2,4} -> [2,3,4]`. */
export function versesInRun(run: VerseRun): number[] {
  const verses: number[] = []
  for (let verse = run.start; verse <= run.end; verse++) {
    verses.push(verse)
  }
  return verses
}

/** One request's worth of a write: the passage it addresses, the verses it answers for. */
export type WriteUnit = { passageId: string; verses: number[] }

/**
 * Splits a write into the requests that carry it. Applies collapse contiguous
 * verses into a single ranged POST per run — [16,17,18,20] is two requests, not
 * four. Removals (`color === null`) go one verse at a time, never a range,
 * because range DELETE is unsupported server-side and a DELETE carries no color,
 * so a wholesale run would take any other color caught inside it.
 *
 * Shared by the tap-time write path and the drain: the two must put identical
 * requests on the wire, and this is the rule that decides what they look like.
 */
export function toWriteUnits(
  scope: HighlightScope,
  verses: readonly number[],
  color: string | null,
): WriteUnit[] {
  return color === null
    ? verses.map((verse) => ({
        passageId: formatPassageId(scope.book, scope.chapter, { start: verse, end: verse }),
        verses: [verse],
      }))
    : collapseVerseRuns(verses).map((run) => ({
        passageId: formatPassageId(scope.book, scope.chapter, run),
        verses: versesInRun(run),
      }))
}

/**
 * A raw verse selection reduced to its canonical form: de-duplicated, sorted
 * ascending, non-positive numbers dropped. Reuses {@link collapseVerseRuns} so
 * normalization lives in exactly one place.
 *
 * Not web's `normalizeVerses` — that one is private to `verse-share.ts` and
 * serves copy/share reference formatting. This exists because writes need the
 * canonical *verse list* (to paint and to report outcomes), while
 * `collapseVerseRuns` yields runs.
 */
export function normalizeVerseSelection(verses: readonly number[]): number[] {
  return collapseVerseRuns(verses).flatMap(versesInRun)
}

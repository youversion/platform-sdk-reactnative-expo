/**
 * Pure optimistic-overlay math for the native highlights layer.
 *
 * Ported from the web SDK's `bible-reader-highlights-machine.ts` (`claimVerses`,
 * `settleWrite`, `reconcileOverlay`) so the two SDKs agree on what the user sees
 * while a write is in flight. Two semantics are load-bearing and are adopted
 * rather than re-derived:
 *
 * 1. **Ownership tokens.** Every write allocates a fresh token object and stamps
 *    the verses it claims. A settling write only touches verses it *still* owns,
 *    so a slow failure cannot wipe paint a newer write has since put down.
 * 2. **Remove overlays survive reconciliation.** A stale read replica can echo
 *    back the color that was just deleted; retiring the overlay on that echo
 *    repaints the verse for a beat ("vapor"). See {@link shouldRetire} — our
 *    rule diverges from web's, deliberately.
 *
 * This module is React-free and side-effect-free: no storage, no network, no
 * hooks. Every state transition returns the *same* object when nothing changed,
 * because the projected output crosses the native/DOM bridge as a serialized
 * prop.
 */

import type { Highlight } from '@youversion/platform-core'
import type { HighlightScope, ServerColors } from './constants'

/**
 * Pending local edits for a scope: a hex color where the user just applied one,
 * `null` where they just removed one. Sits on top of Server Colors. Never
 * persisted.
 */
export type HighlightOverlay = Record<number, string | null>

export type WriteOp = 'apply' | 'remove'

/**
 * Per-write ownership marker. Compared by **object identity**, never by value —
 * the `op` field is for debugging only. Allocate a fresh one per write.
 */
export type WriteToken = { readonly op: WriteOp }

/** What a settled write is waiting for the server to confirm. */
export type ReconcileEntry = { op: WriteOp; color: string }

export type OptimisticState = {
  scope: HighlightScope
  userId: string | null
  serverColors: ServerColors
  overlay: HighlightOverlay
  reconcile: ReadonlyMap<number, ReconcileEntry>
  writeIntent: ReadonlyMap<number, WriteToken>
}

export function createWriteToken(op: WriteOp): WriteToken {
  return { op }
}

/**
 * A fresh state for an identity (scope + user), seeded with whatever server
 * truth is already known. Also the `reset` transition: clearing `writeIntent` is
 * what stops an in-flight write from settling onto a colliding verse number in
 * the scope the user has since navigated to.
 */
export function createOptimisticState(input: {
  scope: HighlightScope
  userId: string | null
  serverColors: ServerColors
}): OptimisticState {
  return {
    scope: input.scope,
    userId: input.userId,
    serverColors: input.serverColors,
    overlay: {},
    reconcile: new Map(),
    writeIntent: new Map(),
  }
}

/**
 * Claims verses for a write: stamps each with the op's ownership `token`, drops
 * any pending reconciliation (a newer write supersedes it), and paints the
 * optimistic overlay (`color` for an apply, `null` for a remove).
 *
 * Dropping the reconcile entry is also the third retirement path for a remove
 * overlay — the other two are a scope/identity change and a confirming fetch.
 */
export function claim(
  state: OptimisticState,
  verses: readonly number[],
  token: WriteToken,
  color: string | null,
): OptimisticState {
  if (verses.length === 0) {
    return state
  }
  const writeIntent = new Map(state.writeIntent)
  const reconcile = new Map(state.reconcile)
  const overlay = { ...state.overlay }
  for (const verse of verses) {
    writeIntent.set(verse, token)
    reconcile.delete(verse)
    overlay[verse] = color
  }
  return { ...state, writeIntent, reconcile, overlay }
}

/**
 * Cleanup for a finished batch, deciding what happens to paint already on
 * screen. Succeeded verses keep their paint and register a reconcile entry so a
 * later fetch knows when to retire it; failed verses have their overlay entry
 * **deleted** — for a failed remove that restores the highlight, same mechanism,
 * correct result.
 *
 * Both loops are guarded on `writeIntent.get(verse) === token` by object
 * identity. The scenario: tap yellow on verse 16; before that POST returns, tap
 * green on 16 (which re-stamps the intent); then yellow's POST fails. Unguarded,
 * yellow's settle deletes the overlay and wipes the green the user is looking at
 * over a failure that has nothing to do with it. Guarded, yellow sees green's
 * token instead of its own and leaves it alone.
 *
 * Releasing the claim (`writeIntent.delete`) is what stops intents accumulating
 * until sign-out.
 */
export function settle(
  state: OptimisticState,
  batch: {
    token: WriteToken
    op: WriteOp
    color: string
    succeededVerses: readonly number[]
    failedVerses: readonly number[]
  },
): OptimisticState {
  const overlay = { ...state.overlay }
  const reconcile = new Map(state.reconcile)
  const writeIntent = new Map(state.writeIntent)
  let changed = false

  for (const verse of batch.succeededVerses) {
    if (state.writeIntent.get(verse) !== batch.token) {
      continue
    }
    reconcile.set(verse, { op: batch.op, color: batch.color })
    writeIntent.delete(verse)
    changed = true
  }

  for (const verse of batch.failedVerses) {
    if (state.writeIntent.get(verse) !== batch.token) {
      continue
    }
    if (verse in overlay) {
      delete overlay[verse]
    }
    writeIntent.delete(verse)
    changed = true
  }

  return changed ? { ...state, overlay, reconcile, writeIntent } : state
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
 * overlay and briefly paints green. That needs the server two steps behind
 * rather than one.
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
 * Stores fresh server truth and retires any reconcile entries it confirms.
 * Returns the same state object when the fetch changed nothing, so the projected
 * highlights prop stays referentially stable across the bridge.
 */
export function serverUpdated(state: OptimisticState, serverColors: ServerColors): OptimisticState {
  const colorsChanged = !serverColorsEqual(state.serverColors, serverColors)

  if (state.reconcile.size === 0) {
    return colorsChanged ? { ...state, serverColors } : state
  }

  const overlay = { ...state.overlay }
  const reconcile = new Map(state.reconcile)
  let retired = false
  let overlayChanged = false

  for (const [verse, entry] of state.reconcile) {
    if (!shouldRetire(entry, serverColors[verse])) {
      continue
    }
    reconcile.delete(verse)
    retired = true
    if (verse in overlay) {
      delete overlay[verse]
      overlayChanged = true
    }
  }

  if (!colorsChanged && !retired) {
    return state
  }
  return {
    ...state,
    serverColors,
    reconcile: retired ? reconcile : state.reconcile,
    overlay: overlayChanged ? overlay : state.overlay,
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

/** Server truth with the optimistic overlay applied — what the user sees. */
export function selectMergedColors(state: OptimisticState): Record<number, string> {
  const merged: Record<number, string> = { ...state.serverColors }
  for (const [verse, color] of Object.entries(state.overlay)) {
    if (color === null) {
      delete merged[Number(verse)]
    } else {
      merged[Number(verse)] = color
    }
  }
  return merged
}

/**
 * The rendered state as one `Highlight` per verse, ascending. Per-verse (never
 * ranges) so that `deriveServerColors(selectHighlights(state), scope)` is an
 * exact round trip.
 */
export function selectHighlights(state: OptimisticState): Highlight[] {
  const merged = selectMergedColors(state)
  const { versionId, book, chapter } = state.scope
  return Object.keys(merged)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((verse) => {
      const color = merged[verse]
      return color === undefined
        ? []
        : [{ version_id: versionId, passage_id: `${book}.${chapter}.${verse}`, color }]
    })
}

/**
 * Of `verses`, the ones the user currently *sees* in `color` — optimistic paint
 * included. The remove path targets what is on screen, not what the server last
 * said, because a DELETE carries a passage id and no color: removing yellow
 * across a selection that also holds a blue verse must not destroy the blue one.
 */
export function selectVersesInColor(
  state: OptimisticState,
  verses: readonly number[],
  color: string,
): number[] {
  const merged = selectMergedColors(state)
  return verses.filter((verse) => merged[verse] === color)
}

/**
 * Of `verses`, the ones `token` still owns — compared by object identity, the
 * same guard {@link settle} applies.
 *
 * The queue needs this *before* settling: a transient failure re-queues only the
 * verses the failing write still owns. Yellow failing on verse 16 after the user
 * re-tapped it green must not schedule a retry that paints yellow back over the
 * green the user is looking at.
 */
export function selectOwnedVerses(
  state: OptimisticState,
  verses: readonly number[],
  token: WriteToken,
): number[] {
  return verses.filter((verse) => state.writeIntent.get(verse) === token)
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

/**
 * A raw verse selection reduced to its canonical form: de-duplicated, sorted
 * ascending, non-positive numbers dropped. Reuses {@link collapseVerseRuns} so
 * normalization lives in exactly one place.
 *
 * Not web's `normalizeVerses` — that one is private to `verse-share.ts` and
 * serves copy/share reference formatting. This exists because writes need the
 * canonical *verse list* (to claim the overlay and to report outcomes), while
 * `collapseVerseRuns` yields runs.
 */
export function normalizeVerseSelection(verses: readonly number[]): number[] {
  return collapseVerseRuns(verses).flatMap(versesInRun)
}

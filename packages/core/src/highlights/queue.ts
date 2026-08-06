/**
 * The durable **Pending Operation** queue: writes that were authorized, painted,
 * and then failed on a network the app cannot control.
 *
 * Distinct from a **Pending Highlight** (`packages/ui/src/native/use-reader-highlights.ts`),
 * which is a *pre-auth* tap held in memory while the user consents. Conflating
 * the two is the failure mode this design spent the most words separating: a
 * Pending Highlight must never outlive the browser session it is waiting on,
 * while a Pending Operation must survive an app kill.
 *
 * Swift's queue is memory-only and loses queued writes on an app kill — a known
 * gap on their side. Inheriting it would land hardest on Android, where the OS
 * kills backgrounded apps far more aggressively, so this one persists to MMKV
 * under a prefix `clearHighlightQueue()` can wipe in one pass, exactly as the
 * highlights cache and the granted-permissions mirror already do.
 *
 * This module owns persistence, ordering, backoff, the generation counter, and
 * the in-flight count. It knows nothing about the network: issuing requests and
 * painting belong to `use-highlights.ts`, which keeps every rule here testable
 * without a renderer or a fetch.
 *
 * **`better-result`'s `Result.try` retry config is not a substitute.** It retries
 * within a single awaited call, so it does not survive an app restart, does not
 * persist, and has no generation concept for sign-out. Adopting it would also
 * mean a new direct dependency in `packages/core` and closing the `src/result.ts`
 * seam — a call to make deliberately, not as a drive-by import.
 */

import { z } from 'zod'

import { mmkvStorage } from '../storage/mmkv-storage'
import type { HighlightScope } from './constants'

export const MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX = 'yvp.highlightQueue.'

export function highlightQueueKey(userId: string): string {
  return `${MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX}${userId}`
}

/** A write that has been painted locally and still owes the server a request. */
export type PendingOp = {
  id: string
  /**
   * The queue generation this op was enqueued under. A result that comes back
   * carrying a stale generation is discarded rather than re-queued, which is
   * what stops a departed user's write from landing on the next account.
   */
  generation: number
  op: 'apply' | 'remove'
  scope: HighlightScope
  color: string
  verses: number[]
  /** Failed attempts so far. Starts at 1 — the direct write already burned one. */
  attempts: number
  nextAttemptAt: number
  /**
   * Not in the design's op shape, but the stale-op cutoff needs a fixed origin
   * and `nextAttemptAt` moves forward with every backoff.
   */
  createdAt: number
}

/** Swift's schedule: double from 2s, hold at 30s. */
export const QUEUE_INITIAL_BACKOFF_MS = 2_000
export const QUEUE_MAX_BACKOFF_MS = 30_000

/**
 * How long an op may keep retrying before it is dropped. This is the queue's
 * only give-up rule — there is no attempt limit, because a user who is offline
 * for an hour should still get their highlights, and the optimistic paint is
 * what makes the wait invisible.
 */
export const QUEUE_STALE_OP_MAX_AGE_MS = 24 * 60 * 60 * 1_000

export function backoffDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1)
  const delay = QUEUE_INITIAL_BACKOFF_MS * 2 ** exponent
  return Math.min(delay, QUEUE_MAX_BACKOFF_MS)
}

const pendingOpSchema = z.object({
  id: z.string().min(1),
  generation: z.number().int().nonnegative(),
  op: z.enum(['apply', 'remove']),
  scope: z.object({
    versionId: z.number().int().positive(),
    book: z.string().min(1),
    chapter: z.string().min(1),
  }),
  color: z.string().regex(/^[0-9a-f]{6}$/i),
  verses: z.array(z.number().int().positive()).min(1),
  attempts: z.number().int().nonnegative(),
  nextAttemptAt: z.number(),
  createdAt: z.number(),
})

/**
 * The user id is stored in the value as well as the key, same discipline as the
 * granted-permissions mirror: a mismatch means the entry was written by another
 * key scheme or hand-tampered, and replaying somebody else's writes under this
 * user's token is the one outcome worth ruling out absolutely.
 */
const storedQueueSchema = z.object({
  userId: z.string().min(1),
  // Deliberately `unknown` rather than `z.array(pendingOpSchema)`: validating
  // the array as a whole makes the read all-or-nothing, so one unreadable entry
  // would hide every valid queued write behind it — silent data loss that also
  // survives a cold start, since nothing on disk ever gets rewritten. Ops are
  // validated one at a time in `readOps` instead.
  ops: z.array(z.unknown()),
})

export type HighlightQueueSnapshot = {
  ops: PendingOp[]
  generation: number
  /**
   * True while the queue is non-empty **or** a write is in flight. The in-flight
   * half is Swift's #180 fix: without it, signing out during the one request
   * that is actually on the wire skips the warning and loses the write silently.
   */
  hasPending: boolean
}

let generation = 0
let inFlightCount = 0
let idCounter = 0

/**
 * `getHighlightQueueSnapshot` backs a `useSyncExternalStore` snapshot, so it must
 * return a referentially stable value between publishes or React re-renders
 * forever. Every mutation clears the whole map rather than one entry.
 */
const snapshots = new Map<string, HighlightQueueSnapshot>()
const listeners = new Set<() => void>()

/** Cache key for the signed-out case, which can never collide with a user id. */
const ANONYMOUS = ' anonymous'

export function subscribeHighlightQueue(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function publish(): void {
  snapshots.clear()
  // Copy first: a listener may unsubscribe during notification.
  for (const listener of [...listeners]) {
    listener()
  }
}

export function getHighlightQueueSnapshot(userId: string | null): HighlightQueueSnapshot {
  const key = userId === null || userId === '' ? ANONYMOUS : userId
  const cached = snapshots.get(key)
  if (cached !== undefined) {
    return cached
  }
  const ops = userId ? readOps(userId) : []
  const snapshot: HighlightQueueSnapshot = {
    ops,
    generation,
    hasPending: ops.length > 0 || inFlightCount > 0,
  }
  snapshots.set(key, snapshot)
  return snapshot
}

export function getPendingOps(userId: string | null): PendingOp[] {
  return getHighlightQueueSnapshot(userId).ops
}

export function hasPendingHighlightOperations(userId: string | null): boolean {
  return getHighlightQueueSnapshot(userId).hasPending
}

export function getHighlightQueueGeneration(): number {
  return generation
}

export function isCurrentGeneration(opGeneration: number): boolean {
  return opGeneration === generation
}

/**
 * Marks a write as on the wire until the returned release is called. The release
 * is idempotent, so a `finally` that runs twice cannot drive the count negative.
 */
export function beginHighlightWrite(): () => void {
  inFlightCount += 1
  publish()
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    inFlightCount = Math.max(0, inFlightCount - 1)
    publish()
  }
}

function readOps(userId: string): PendingOp[] {
  try {
    const raw = mmkvStorage.getString(highlightQueueKey(userId))
    if (raw == null) {
      return []
    }
    const parsed = storedQueueSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.userId !== userId) {
      return []
    }

    const kept: PendingOp[] = []
    for (const candidate of parsed.data.ops) {
      const op = pendingOpSchema.safeParse(candidate)
      if (op.success) {
        // Anything on disk belongs to the current generation by construction:
        // `clearHighlightQueue` wipes storage and bumps the counter in the same
        // call, so a stored op can never predate the bump. Re-stamping is what
        // lets a cold start — where the in-memory counter is back at 0 — replay
        // stored work instead of discarding all of it as stale.
        kept.push({ ...op.data, generation })
      }
    }

    if (kept.length !== parsed.data.ops.length) {
      // Repair the store so the bad entry stops being re-parsed on every read.
      // Persist WITHOUT publishing: this runs inside `getHighlightQueueSnapshot`,
      // which React calls during render, and notifying subscribers there would
      // set state on other components mid-render.
      persistOps(userId, kept)
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[YouVersion SDK] Discarded ${parsed.data.ops.length - kept.length} unreadable queued ` +
            'highlight write(s). The remaining queued writes are unaffected.',
        )
      }
    }
    return kept
  } catch {
    return []
  }
}

function persistOps(userId: string, ops: readonly PendingOp[]): void {
  if (ops.length === 0) {
    mmkvStorage.remove(highlightQueueKey(userId))
  } else {
    mmkvStorage.set(highlightQueueKey(userId), JSON.stringify({ userId, ops }))
  }
}

function writeOps(userId: string, ops: readonly PendingOp[]): void {
  persistOps(userId, ops)
  publish()
}

/**
 * Drops ops past the stale cutoff. Runs on every peek rather than only at launch
 * so a queue that never gets a due window still cannot grow without bound.
 */
function pruneStale(userId: string, ops: readonly PendingOp[], now: number): PendingOp[] {
  const kept = ops.filter((op) => now - op.createdAt <= QUEUE_STALE_OP_MAX_AGE_MS)
  if (kept.length === ops.length) {
    return [...ops]
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[YouVersion SDK] Dropped ${ops.length - kept.length} highlight write(s) that could not ` +
        'reach the server before the retry window closed.',
    )
  }
  writeOps(userId, kept)
  return kept
}

export function enqueuePendingOp(
  userId: string | null,
  input: {
    op: 'apply' | 'remove'
    scope: HighlightScope
    color: string
    verses: readonly number[]
    now?: number
  },
): PendingOp | null {
  if (!userId || input.verses.length === 0) {
    return null
  }
  const now = input.now ?? Date.now()
  idCounter += 1
  const pending: PendingOp = {
    id: `${now}.${idCounter}`,
    generation,
    op: input.op,
    scope: input.scope,
    color: input.color,
    verses: [...input.verses],
    // The direct write that just failed is attempt 1, so the first retry waits
    // the full 2s rather than firing back-to-back into the same dead network.
    attempts: 1,
    nextAttemptAt: now + backoffDelayMs(1),
    createdAt: now,
  }
  writeOps(userId, [...readOps(userId), pending])
  return pending
}

/**
 * The head of the queue, if it is due.
 *
 * Strict head-of-line: returning a later op because the head is backing off
 * would let a remove overtake the apply it is meant to undo. One stuck op holds
 * the rest, which is the correct trade — they are almost always failing on the
 * same network, and the stale cutoff still bounds it.
 */
export function peekDuePendingOp(userId: string | null, now = Date.now()): PendingOp | null {
  if (!userId) {
    return null
  }
  const head = pruneStale(userId, readOps(userId), now)[0]
  if (head === undefined || head.nextAttemptAt > now) {
    return null
  }
  return head
}

/** When the head is next due, for scheduling a wake-up. */
export function nextPendingAttemptAt(userId: string | null): number | null {
  if (!userId) {
    return null
  }
  return readOps(userId)[0]?.nextAttemptAt ?? null
}

export function completePendingOp(userId: string | null, id: string): void {
  if (!userId) {
    return
  }
  const ops = readOps(userId)
  const kept = ops.filter((op) => op.id !== id)
  if (kept.length !== ops.length) {
    writeOps(userId, kept)
  }
}

/**
 * Narrows an op to the verses that still need retrying — the rest either landed
 * or failed permanently. Removes the op outright when nothing is left.
 */
export function retainPendingVerses(
  userId: string | null,
  id: string,
  verses: readonly number[],
): void {
  if (!userId) {
    return
  }
  const ops = readOps(userId)
  const index = ops.findIndex((op) => op.id === id)
  const current = ops[index]
  if (current === undefined) {
    return
  }
  const kept = current.verses.filter((verse) => verses.includes(verse))
  if (kept.length === current.verses.length) {
    return
  }
  const next = [...ops]
  if (kept.length === 0) {
    next.splice(index, 1)
  } else {
    next[index] = { ...current, verses: kept }
  }
  writeOps(userId, next)
}

/** Backs an op off by one attempt. Returns the rescheduled op, or `null` if it is gone. */
export function reschedulePendingOp(
  userId: string | null,
  id: string,
  now = Date.now(),
): PendingOp | null {
  if (!userId) {
    return null
  }
  const ops = readOps(userId)
  const index = ops.findIndex((op) => op.id === id)
  const current = ops[index]
  if (current === undefined) {
    return null
  }
  const attempts = current.attempts + 1
  const rescheduled: PendingOp = {
    ...current,
    attempts,
    nextAttemptAt: now + backoffDelayMs(attempts),
  }
  const next = [...ops]
  next[index] = rescheduled
  writeOps(userId, next)
  return rescheduled
}

/**
 * Drops `verses` from every queued op because a newer tap has claimed them.
 *
 * Without this, tapping yellow (which fails and queues), then green on the same
 * verse, leaves a yellow retry scheduled behind green's request — so the server
 * settles on yellow while the reader shows green. The overlay's ownership token
 * protects the paint; this protects the server.
 */
export function supersedePendingVerses(userId: string | null, verses: readonly number[]): void {
  if (!userId || verses.length === 0) {
    return
  }
  const ops = readOps(userId)
  if (ops.length === 0) {
    return
  }
  let changed = false
  const next: PendingOp[] = []
  for (const op of ops) {
    const kept = op.verses.filter((verse) => !verses.includes(verse))
    if (kept.length === op.verses.length) {
      next.push(op)
      continue
    }
    changed = true
    if (kept.length > 0) {
      next.push({ ...op, verses: kept })
    }
  }
  if (changed) {
    writeOps(userId, next)
  }
}

/**
 * Discards every queued write and invalidates anything already on the wire.
 *
 * Called from `clearAuthState` (sign-out, revoked refresh token) and from the
 * context's `discardPendingHighlights()`. Confirming the sign-out warning
 * **discards** rather than flushing, matching Swift: the alert already said the
 * work would be lost, and flushing on a dead network hangs the sign-out the user
 * just asked for.
 */
export function clearHighlightQueue(): void {
  for (const key of mmkvStorage.getAllKeys()) {
    if (key.startsWith(MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX)) {
      mmkvStorage.remove(key)
    }
  }
  generation += 1
  inFlightCount = 0
  publish()
}

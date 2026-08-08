/**
 * Sends Queued Writes the write path could not. See ADR 0017.
 *
 * Lives at the provider, not in `useHighlights`, because a parked write outlives
 * the chapter it was made in: the queue is the only record of it, and after a
 * relaunch nothing in memory remembers the scope.
 */

import { nextBackoffDelay } from './backoff'
import { mergeCachedHighlights } from './cache'
import { isWriteClaimed } from './claims'
import { toWriteUnits } from './optimistic'
import { dropWrites, getQueuedWrites, listQueuedScopes } from './queue'
import type { HighlightsApi } from './api'
import type { HighlightScope } from './constants'

/** Read fresh on every pass: a sign-out mid-drain must stop it. */
export type DrainAuth = {
  userId: string | null
  accessToken: string | null
  ensureFreshToken: (() => Promise<void>) | null
}

export type HighlightQueueDrain = {
  /** Try everything due now. Coalesces while a pass is running. */
  drainNow: () => void
  /** A write just failed; start the retry clock without re-sending it. */
  noteParkedWrite: () => void
  stop: () => void
}

type BackoffRecord = { failures: number; nextAttemptAt: number }

export function startHighlightQueueDrain(deps: {
  api: HighlightsApi
  getAuth: () => DrainAuth
}): HighlightQueueDrain {
  const { api, getAuth } = deps

  /**
   * In memory: a relaunch is itself a drain trigger, so persisting the wait would
   * only deny a fresh start the attempt it is entitled to.
   */
  const backoff = new Map<string, BackoffRecord>()

  let stopped = false
  let running = false
  let rerun = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function backoffKey(scope: HighlightScope, verse: number): string {
    return `${scope.versionId}|${scope.book}|${scope.chapter}|${verse}`
  }

  function noteFailure(scope: HighlightScope, verses: readonly number[]): void {
    const now = Date.now()
    for (const verse of verses) {
      const key = backoffKey(scope, verse)
      const failures = backoff.get(key)?.failures ?? 0
      backoff.set(key, { failures: failures + 1, nextAttemptAt: now + nextBackoffDelay(failures) })
    }
  }

  function land(
    userId: string,
    scope: HighlightScope,
    verses: readonly number[],
    color: string | null,
  ): void {
    const owed = getQueuedWrites(userId, scope)
    const landed = verses.filter((verse) => owed[verse]?.local === color)
    if (landed.length > 0) {
      // Cache before queue: a crash between the two must leave the write owed
      // rather than leave the paint gone.
      mergeCachedHighlights(userId, scope, landed, color)
      dropWrites({ userId, scope, verses: landed, color })
    }
    for (const verse of verses) {
      backoff.delete(backoffKey(scope, verse))
    }
  }

  async function sendColor(
    auth: { userId: string; accessToken: string },
    scope: HighlightScope,
    color: string | null,
    verses: readonly number[],
  ): Promise<void> {
    await Promise.all(
      toWriteUnits(scope, verses, color).map(async (unit) => {
        const result =
          color === null
            ? await api.deleteHighlight(auth.accessToken, unit.passageId, {
                version_id: scope.versionId,
              })
            : await api.createHighlight(auth.accessToken, {
                version_id: scope.versionId,
                passage_id: unit.passageId,
                color,
              })

        if (result.ok) {
          land(auth.userId, scope, unit.verses, color)
        } else {
          noteFailure(scope, unit.verses)
        }
      }),
    )
  }

  async function drainScope(
    auth: { userId: string; accessToken: string },
    scope: HighlightScope,
  ): Promise<void> {
    const queued = getQueuedWrites(auth.userId, scope)
    const now = Date.now()
    const due = new Map<string | null, number[]>()
    const satisfied = new Map<string | null, number[]>()

    for (const [verseKey, entry] of Object.entries(queued)) {
      const verse = Number(verseKey)
      if (entry.local === entry.server) {
        push(satisfied, entry.local, verse)
      } else if (
        !isWriteClaimed(auth.userId, scope, verse) &&
        (backoff.get(backoffKey(scope, verse))?.nextAttemptAt ?? 0) <= now
      ) {
        push(due, entry.local, verse)
      }
    }

    for (const [color, verses] of satisfied) {
      dropWrites({ userId: auth.userId, scope, verses, color })
    }
    await Promise.all([...due].map(([color, verses]) => sendColor(auth, scope, color, verses)))
  }

  async function drainDue(): Promise<void> {
    const initial = getAuth()
    if (initial.userId === null || initial.accessToken === null) {
      return
    }
    if (listQueuedScopes(initial.userId).length === 0) {
      return
    }

    await initial.ensureFreshToken?.()

    for (const scope of listQueuedScopes(initial.userId)) {
      // Re-read per scope: a sign-out or user switch mid-pass must not send the
      // departed user's passage under whatever token is current now.
      const auth = getAuth()
      if (stopped || auth.userId !== initial.userId || auth.accessToken === null) {
        return
      }
      await drainScope({ userId: auth.userId, accessToken: auth.accessToken }, scope)
    }
  }

  async function runPass(): Promise<void> {
    running = true
    try {
      do {
        rerun = false
        try {
          await drainDue()
        } catch {
          // `ensureFreshToken` is documented not to throw, but a drain that dies
          // here would stop rescheduling and park every write permanently.
        }
      } while (rerun && !stopped)
    } finally {
      running = false
    }
    scheduleNext()
  }

  function scheduleNext(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (stopped) {
      return
    }

    const { userId } = getAuth()
    const scopes = userId === null ? [] : listQueuedScopes(userId)
    if (userId === null || scopes.length === 0) {
      backoff.clear()
      return
    }

    const now = Date.now()
    const live = new Set<string>()
    let soonest = Infinity
    for (const scope of scopes) {
      for (const verseKey of Object.keys(getQueuedWrites(userId, scope))) {
        const key = backoffKey(scope, Number(verseKey))
        live.add(key)
        soonest = Math.min(soonest, backoff.get(key)?.nextAttemptAt ?? now + nextBackoffDelay(0))
      }
    }
    // A record outlives its entry when a re-tap cancels the write it counted.
    for (const key of [...backoff.keys()]) {
      if (!live.has(key)) {
        backoff.delete(key)
      }
    }
    if (soonest === Infinity) {
      return
    }

    // Floored: a claimed verse keeps a past-due record, and an unfloored delay
    // would spin on it until the hook releases.
    timer = setTimeout(
      () => {
        timer = null
        startPass(false)
      },
      Math.max(soonest - now, nextBackoffDelay(0)),
    )
  }

  /**
   * A `prompted` pass retires every wait: the wait was a guess about a network
   * nobody had asked, and a trigger is the answer arriving. Failure counts stay,
   * so the decay widens from where it was rather than starting over.
   */
  function startPass(prompted: boolean): void {
    if (stopped) {
      return
    }
    if (prompted) {
      for (const record of backoff.values()) {
        record.nextAttemptAt = 0
      }
    }
    if (running) {
      rerun = true
      return
    }
    void runPass()
  }

  return {
    drainNow() {
      startPass(true)
    },
    noteParkedWrite() {
      // Does not drain: the network just refused this write. Only start the clock.
      if (!stopped && !running) {
        scheduleNext()
      }
    },
    stop() {
      stopped = true
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      backoff.clear()
    },
  }
}

function push<Key>(groups: Map<Key, number[]>, key: Key, verse: number): void {
  const existing = groups.get(key)
  if (existing === undefined) {
    groups.set(key, [verse])
  } else {
    existing.push(verse)
  }
}

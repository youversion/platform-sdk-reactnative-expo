/**
 * Sends Queued Writes the write path could not. See ADR 0018.
 *
 * Lives at the provider, not in `useHighlights`, because a parked write outlives
 * the chapter it was made in: the queue is the only record of it, and after a
 * relaunch nothing in memory remembers the scope.
 */

import type { AccessTokenResult, GetAccessTokenOptions } from '../auth'
import { nextBackoffDelay } from './backoff'
import { mergeCachedHighlights } from './cache'
import { isWriteClaimed } from './claims'
import { toWriteUnits } from './optimistic'
import { dropRejectedWrites, dropWrites, getQueuedWrites, listQueuedScopes } from './queue'
import type { HighlightsApi } from './api'
import type { HighlightScope } from './constants'

/** Read fresh on every pass: a sign-out mid-drain must stop it. */
export type DrainAuth = {
  userId: string | null
  accessToken: string | null
  ensureFreshToken: (() => Promise<void>) | null
  /** Outcome-reporting accessor. Forced mint for the one retry a refusal earns. */
  getAccessToken: ((options?: GetAccessTokenOptions) => Promise<AccessTokenResult>) | null
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

  /**
   * Settles a write the server took: the paint is now server truth, so the entry
   * is no longer owed. The counterpart is {@link revert}; between them they are
   * the only two ways an entry leaves this drain.
   */
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

  /**
   * Settles a write the server refused twice by taking its paint back to the
   * entry's `server` side, and tells mounted readers so the verse un-paints
   * without a remount. The counterpart to {@link land}. See ADR 0018.
   */
  function revert(
    userId: string,
    scope: HighlightScope,
    verses: readonly number[],
    color: string | null,
  ): void {
    const owed = getQueuedWrites(userId, scope)
    const byServer = new Map<string | null, number[]>()
    for (const verse of verses) {
      const entry = owed[verse]
      if (entry?.local === color) {
        push(byServer, entry.server, verse)
      }
    }

    // Cache before queue, as `land` does — here the cache write is the un-paint.
    for (const [server, group] of byServer) {
      mergeCachedHighlights(userId, scope, group, server)
    }
    dropRejectedWrites({ userId, scope, verses, color })

    for (const verse of verses) {
      backoff.delete(backoffKey(scope, verse))
    }
  }

  /**
   * A fresh token for the retry, or `null` if there is no route to one — no
   * accessor, a refresh that failed or threw, or one that ended the session
   * this write belongs to. Only a refusal of a genuinely minted token may revert.
   */
  async function forcedToken(userId: string): Promise<string | null> {
    const getAccessToken = getAuth().getAccessToken
    if (getAccessToken === null) {
      return null
    }
    let result: AccessTokenResult
    try {
      result = await getAccessToken({ force: true })
    } catch {
      return null
    }
    if (result.status !== 'ok') {
      return null
    }
    return stopped || result.userId !== userId ? null : result.token
  }

  async function sendColor(
    auth: { userId: string; accessToken: string },
    scope: HighlightScope,
    color: string | null,
    verses: readonly number[],
  ): Promise<void> {
    const send = (token: string, passageId: string) =>
      color === null
        ? api.deleteHighlight(token, passageId, { version_id: scope.versionId })
        : api.createHighlight(token, {
            version_id: scope.versionId,
            passage_id: passageId,
            color,
          })

    await Promise.all(
      toWriteUnits(scope, verses, color).map(async (unit) => {
        const result = await send(auth.accessToken, unit.passageId)
        if (result.ok) {
          land(auth.userId, scope, unit.verses, color)
          return
        }
        if (result.error.kind !== 'auth') {
          noteFailure(scope, unit.verses)
          return
        }

        // The pass already refreshed on leeway, so a refusal means that read was
        // wrong. Mint unconditionally and state the write once more; only a
        // second refusal is the server saying it will never take it.
        const token = await forcedToken(auth.userId)
        if (token === null) {
          noteFailure(scope, unit.verses)
          return
        }

        const retry = await send(token, unit.passageId)
        if (retry.ok) {
          land(auth.userId, scope, unit.verses, color)
        } else if (retry.error.kind === 'auth') {
          revert(auth.userId, scope, unit.verses, color)
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

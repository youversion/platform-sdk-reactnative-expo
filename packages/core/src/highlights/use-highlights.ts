import type { Highlight } from '@youversion/platform-core'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { useYVAuthOptional } from '../auth'
import { invalidateGrantedPermission } from '../auth/granted-permissions'
import { useYouVersion } from '../use-youversion'
import { createHighlightsApi, type HighlightsApi, type HighlightsApiError } from './api'
import { deriveServerColors, getCachedHighlights, setCachedHighlights } from './cache'
import { isHighlightColor, type HighlightScope } from './constants'
import {
  claim,
  collapseVerseRuns,
  createOptimisticState,
  createWriteToken,
  formatPassageId,
  normalizeVerseSelection,
  selectHighlights,
  selectOwnedVerses,
  selectVersesInColor,
  serverUpdated,
  settle,
  versesInRun,
  type OptimisticState,
  type WriteOp,
  type WriteToken,
} from './optimistic'
import {
  beginHighlightWrite,
  completePendingOp,
  enqueuePendingOp,
  getHighlightQueueSnapshot,
  isCurrentGeneration,
  nextPendingAttemptAt,
  peekDuePendingOp,
  reschedulePendingOp,
  retainPendingVerses,
  subscribeHighlightQueue,
  supersedePendingVerses,
  type PendingOp,
} from './queue'

export type UseHighlightsOptions = {
  versionId: number
  book: string
  chapter: string
}

export type HighlightWriteReason = 'not-signed-in' | 'auth' | 'transient' | 'invalid'

export type HighlightWriteOutcome =
  | { status: 'ok'; verses: number[] }
  | { status: 'noop' }
  | {
      status: 'error'
      reason: HighlightWriteReason
      /**
       * Diagnostic only. `ApiClient` replaces the response body with
       * `Request failed with status <n>` outside development builds, so UI must
       * branch on `reason` and never on this text.
       */
      message: string
      /**
       * Did not land on this attempt.
       *
       * What that means depends on `reason`. For `transient` the verses are now
       * **queued for retry** and their optimistic paint *persists* — the write
       * is late, not lost. For every other reason the paint has been reverted
       * and nothing further will be attempted.
       */
      failedVerses: number[]
      /** Landed server-side. Non-empty alongside `failedVerses` means a partial batch. */
      succeededVerses: number[]
    }

/**
 * Fetch failures only. Writes never populate this — they report once, through
 * their return value, so a transient write failure cannot evict a fetch error
 * that is still true.
 */
export type HighlightsFetchError = {
  reason: HighlightWriteReason
  message: string
}

export type UseHighlightsResult = {
  /** Per-verse passage ids, ascending, lowercase. Feed straight into a controlled reader. */
  highlights: Highlight[]
  /** The scope these highlights belong to, so callers can gate an incoming intent. */
  scope: HighlightScope
  /**
   * A GET is in flight. `highlights` is ALWAYS safe to render — the cache read
   * is synchronous, so this never means "no data yet". Never gate a spinner on it.
   */
  isRefreshing: boolean
  error: HighlightsFetchError | null
  /**
   * There is unsaved highlight work: the durable queue is non-empty, or a write
   * is on the wire right now. Gate a sign-out warning on this — the in-flight
   * half is what keeps the window between "popped off the queue" and "server
   * answered" from silently losing a write.
   */
  hasPendingOperations: boolean
  refresh: () => Promise<void>
  apply: (color: string, verses: number[]) => Promise<HighlightWriteOutcome>
  remove: (color: string, verses: number[]) => Promise<HighlightWriteOutcome>
}

const NOT_SIGNED_IN_MESSAGE = 'Not signed in — highlights require an authenticated YouVersion user.'
const INVALID_COLOR_MESSAGE =
  'Unsupported highlight color. Use one of the five YouVersion highlight swatches.'

/**
 * `auth` wins (it changes what the user must do); retrying `invalid` is
 * pointless. `not-signed-in` is ranked but unreachable here — it is never
 * produced by {@link classifyApiError}, only constructed directly, so it can
 * never be one of several competing failures in a batch.
 */
const REASON_RANK: Record<HighlightWriteReason, number> = {
  'not-signed-in': 4,
  auth: 3,
  invalid: 2,
  transient: 1,
}

/**
 * `api.ts` maps 401/403 to `auth` and everything else to `transient`, but
 * `transient` promises "a retry may help" — wrong for any other 4xx. A malformed
 * passage id, a rejected color, and a `uuid_parsing` 422 are all permanent, and
 * a permanent failure presenting as flaky network is expensive to diagnose.
 */
function classifyApiError(error: HighlightsApiError): HighlightWriteReason {
  if (error.kind === 'auth') {
    return 'auth'
  }
  if (error.status !== undefined && error.status >= 400 && error.status < 500) {
    return 'invalid'
  }
  return 'transient'
}

let hasWarnedMissingUserId = false

/**
 * `YVUserInfo.id` is optional, and `setAuthState` only persists user info when
 * one is passed — which happens on sign-in, never on the refresh path. Running
 * cache-less is a real degradation (no instant mount), so say so once rather
 * than failing silently.
 */
function warnMissingUserId(): void {
  if (hasWarnedMissingUserId || process.env.NODE_ENV === 'production') {
    return
  }
  hasWarnedMissingUserId = true
  console.warn(
    '[YouVersion SDK] Signed in but no user id is available, so highlights cannot be cached. ' +
      'Highlights still load from the network; the instant-mount cache is disabled for this session.',
  )
}

type Identity = {
  key: string
  scope: HighlightScope
  userId: string | null
  generation: number
}

/**
 * The generation is part of the identity so a discard (sign-out, or an explicit
 * `discardPendingHighlights()`) reseeds state through the render-time reset that
 * a user or chapter change already uses. That drops unconfirmed paint *and*
 * clears `writeIntent`, so a result that arrives after the discard settles onto
 * nothing.
 */
function identityKeyFor(userId: string | null, scope: HighlightScope, generation: number): string {
  return `${userId ?? '<anonymous>'}|${scope.versionId}|${scope.book}|${scope.chapter}|${generation}`
}

function scopesEqual(a: HighlightScope, b: HighlightScope): boolean {
  return a.versionId === b.versionId && a.book === b.book && a.chapter === b.chapter
}

/**
 * A settling queued op has to find the same ownership token the claim was
 * stamped with, and after a cold start no such token exists in memory. Deriving
 * it from the op id keeps it stable across renders (React may invoke a state
 * initializer twice) and across the reseed a chapter change performs.
 */
const queueTokens = new Map<string, WriteToken>()

function tokenForPendingOp(pending: PendingOp): WriteToken {
  const existing = queueTokens.get(pending.id)
  if (existing !== undefined) {
    return existing
  }
  const token = createWriteToken(pending.op)
  queueTokens.set(pending.id, token)
  return token
}

function initialStateFor(
  scope: HighlightScope,
  userId: string | null,
  pendingOps: readonly PendingOp[],
): OptimisticState {
  const cached = userId === null ? null : getCachedHighlights(userId, scope)
  let state = createOptimisticState({
    scope,
    userId,
    serverColors: cached === null ? {} : deriveServerColors(cached, scope),
  })
  // Repaint work the server has not accepted yet. The cache stores server truth
  // only, so without this a relaunch with a queued write shows the verse
  // unhighlighted until the retry lands — the user watches their own highlight
  // vanish and come back.
  for (const pending of pendingOps) {
    if (!scopesEqual(pending.scope, scope)) {
      continue
    }
    state = claim(
      state,
      pending.verses,
      tokenForPendingOp(pending),
      pending.op === 'apply' ? pending.color : null,
    )
  }
  return state
}

function sameIdentity(state: OptimisticState, identity: Identity): boolean {
  return identityKeyFor(state.userId, state.scope, identity.generation) === identity.key
}

type WriteAttempt = {
  succeededVerses: number[]
  failedVerses: number[]
  errors: HighlightsApiError[]
  /**
   * Failures still paired with the verses they cover. The batch's *worst* reason
   * is what the caller is told, but what re-queues has to be decided per unit:
   * one malformed passage id in a batch must not strand the verses that merely
   * hit a flaky network.
   */
  failures: { verses: number[]; error: HighlightsApiError }[]
}

/**
 * One round of requests for a batch, shared by the direct write and every queued
 * retry so both speak the same wire protocol.
 *
 * Apply collapses contiguous verses into a single ranged POST per run —
 * `[16,17,18,20]` is two requests, not four. Remove issues one DELETE per verse,
 * never a range, because range DELETE is unsupported server-side; if that is
 * ever confirmed to work, this ternary is the only call site that changes.
 */
async function issueWrite(input: {
  api: HighlightsApi
  accessToken: string
  op: WriteOp
  scope: HighlightScope
  color: string
  verses: readonly number[]
}): Promise<WriteAttempt> {
  const { api, accessToken, op, scope, color, verses } = input

  const units =
    op === 'apply'
      ? collapseVerseRuns(verses).map((run) => ({
          passageId: formatPassageId(scope.book, scope.chapter, run),
          verses: versesInRun(run),
        }))
      : verses.map((verse) => ({
          passageId: formatPassageId(scope.book, scope.chapter, { start: verse, end: verse }),
          verses: [verse],
        }))

  const results = await Promise.all(
    units.map((unit) =>
      op === 'apply'
        ? api.createHighlight(accessToken, {
            version_id: scope.versionId,
            passage_id: unit.passageId,
            color,
          })
        : api.deleteHighlight(accessToken, unit.passageId, { version_id: scope.versionId }),
    ),
  )

  const succeededVerses: number[] = []
  const failedVerses: number[] = []
  const errors: HighlightsApiError[] = []
  const failures: { verses: number[]; error: HighlightsApiError }[] = []

  units.forEach((unit, index) => {
    const result = results[index]
    // `results` is 1:1 with `units`, so `undefined` is unreachable — treat it as
    // a failure rather than silently counting it as a success.
    if (result !== undefined && result.ok) {
      succeededVerses.push(...unit.verses)
      return
    }
    failedVerses.push(...unit.verses)
    if (result !== undefined) {
      errors.push(result.error)
      failures.push({ verses: unit.verses, error: result.error })
    }
  })

  return { succeededVerses, failedVerses, errors, failures }
}

/** Of a batch's failures, the verses whose own error is worth retrying. */
function retryableVerses(attempt: WriteAttempt): number[] {
  return attempt.failures
    .filter((failure) => classifyApiError(failure.error) === 'transient')
    .flatMap((failure) => failure.verses)
}

/** `auth` outranks `invalid` outranks `transient` across a mixed batch. */
function worstFailureReason(errors: readonly HighlightsApiError[]): HighlightWriteReason {
  return errors
    .map(classifyApiError)
    .reduce<HighlightWriteReason>(
      (worst, candidate) => (REASON_RANK[candidate] > REASON_RANK[worst] ? candidate : worst),
      'transient',
    )
}

function messageForReason(
  errors: readonly HighlightsApiError[],
  reason: HighlightWriteReason,
): string {
  return (
    errors.find((candidate) => classifyApiError(candidate) === reason)?.message ??
    'Highlight write failed.'
  )
}

/**
 * Instant, optimistic, self-healing highlight state for one chapter.
 *
 * Paints from the MMKV cache synchronously on first render, applies and removes
 * optimistically, and reconciles against the server. This is the only optimistic
 * layer in the stack — the web reader's controlled `highlights` prop is pure
 * projection.
 *
 * A write that fails on the network is **queued, not reverted**: the paint stays
 * put and a persisted retry carries it, surviving an app kill (`queue.ts`). Only
 * a permanent failure — a rejected payload, or an auth answer the prompt flow has
 * to resolve — takes the paint back.
 *
 * Requires `auth` to be configured on `YouVersionProvider`; with no auth
 * configured it behaves exactly as signed out.
 */
export function useHighlights(options: UseHighlightsOptions): UseHighlightsResult {
  const { appKey, apiHost, installationId } = useYouVersion()
  const auth = useYVAuthOptional()

  const accessToken = auth?.accessToken ?? null
  const isAuthLoading = auth?.isLoading ?? false
  const userId = auth?.userInfo?.id ?? null

  const scope = useMemo<HighlightScope>(
    () => ({ versionId: options.versionId, book: options.book, chapter: options.chapter }),
    [options.versionId, options.book, options.chapter],
  )

  const api = useMemo<HighlightsApi>(
    () => createHighlightsApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )

  // Subscribed rather than read once: the queue is module state, mutated by the
  // retry loop and wiped by `clearAuthState`, and `hasPendingOperations` has to
  // re-render the sign-out guard the moment the last write lands.
  const readQueue = useCallback(() => getHighlightQueueSnapshot(userId), [userId])
  const queueSnapshot = useSyncExternalStore(subscribeHighlightQueue, readQueue)

  const currentIdentityKey = identityKeyFor(userId, scope, queueSnapshot.generation)

  // AC 1 — the synchronous cache read. This is only correct on a cold start
  // because AuthProvider seeds `userInfo` from its own useState initializer
  // (`loadCachedUserInfo()`), so `userInfo.id` already exists on first render.
  // Load-bearing coupling: if that seeding ever goes async, instant mount goes
  // with it.
  const [state, setState] = useState<OptimisticState>(() =>
    initialStateFor(scope, userId, queueSnapshot.ops),
  )
  const [identityKey, setIdentityKey] = useState(currentIdentityKey)
  const [error, setError] = useState<HighlightsFetchError | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Reset during render rather than in an effect: an effect would leave one
  // frame where the previous chapter's overlay paints over the new chapter's
  // verse numbers. This is React's documented "adjust state when props change"
  // pattern — the re-render happens before anything is committed to the screen.
  let renderedState = state
  if (identityKey !== currentIdentityKey) {
    renderedState = initialStateFor(scope, userId, queueSnapshot.ops)
    setIdentityKey(currentIdentityKey)
    setState(renderedState)
    setError(null)
  }

  // Latest-value refs for the async layer. Seeded on mount (the fetch effect
  // below runs on the same commit and must see real values), then re-synced by
  // the effect that follows. Async continuations read these rather than closing
  // over one render's values.
  const identityRef = useRef<Identity>({
    key: currentIdentityKey,
    scope,
    userId,
    generation: queueSnapshot.generation,
  })
  const stateRef = useRef(renderedState)
  const authRef = useRef({ accessToken, isAuthLoading })

  // ── The token-loading hold ─────────────────────────────────────────────────
  // `userInfo` is seeded synchronously but `accessToken` only arrives after
  // AuthProvider's async `loadTokens()`. In that window the user IS signed in,
  // so reporting `not-signed-in` would send C3 off to prompt an already
  // signed-in user. Reads recover on their own (the fetch effect is keyed on the
  // token); writes are the exposure, so they wait here.
  //
  // Resolve on EITHER a token arriving OR auth settling with none — never on
  // `isLoading` alone, because `postTokenEndpoint` has no AbortController and a
  // hung network can leave `isLoading` true indefinitely.
  const authWaitersRef = useRef<(() => void)[]>([])

  // Runs after EVERY render, and must stay declared above the fetch effect:
  // effects fire in declaration order, so this is what guarantees `runFetch`
  // reads the identity and token of the render that scheduled it.
  useEffect(() => {
    identityRef.current = {
      key: currentIdentityKey,
      scope,
      userId,
      generation: queueSnapshot.generation,
    }
    stateRef.current = renderedState
    authRef.current = { accessToken, isAuthLoading }

    if (accessToken !== null && userId === null) {
      warnMissingUserId()
    }

    if (accessToken === null && isAuthLoading) {
      return
    }
    const waiters = authWaitersRef.current
    authWaitersRef.current = []
    for (const resolve of waiters) {
      resolve()
    }
  })

  const waitForAuthSettled = useCallback((): Promise<void> => {
    const current = authRef.current
    if (current.accessToken !== null || !current.isAuthLoading) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      authWaitersRef.current.push(resolve)
    })
  }, [])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const inFlightRef = useRef<Promise<void> | null>(null)

  const runFetch = useCallback((): Promise<void> => {
    const existing = inFlightRef.current
    if (existing !== null) {
      return existing
    }

    const token = authRef.current.accessToken
    if (token === null) {
      // Signed out. An abandoned fetch can no longer clear the flag itself (its
      // `finally` sees it is no longer the active request), and nothing else
      // will run — so without this, signing out mid-fetch would leave
      // `isRefreshing` true forever and any bound RefreshControl spinning.
      setIsRefreshing(false)
      return Promise.resolve()
    }

    const captured = identityRef.current
    setIsRefreshing(true)

    const promise: Promise<void> = api
      .getHighlights(token, {
        version_id: captured.scope.versionId,
        passage_id: `${captured.scope.book}.${captured.scope.chapter}`,
      })
      .then((result) => {
        // Late responses for a scope or user the reader has left are dropped —
        // including the sign-out case, where writing the cache would repopulate
        // what `clearHighlightsCache()` just emptied.
        if (identityRef.current.key !== captured.key) {
          return
        }
        if (!result.ok) {
          setError({ reason: classifyApiError(result.error), message: result.error.message })
          return
        }
        if (captured.userId !== null) {
          setCachedHighlights(captured.userId, captured.scope, result.value.data)
        }
        const serverColors = deriveServerColors(result.value.data, captured.scope)
        setState((prev) =>
          sameIdentity(prev, captured) ? serverUpdated(prev, serverColors) : prev,
        )
        setError(null)
      })
      .finally(() => {
        if (inFlightRef.current === promise) {
          inFlightRef.current = null
          setIsRefreshing(false)
        }
      })

    inFlightRef.current = promise
    return promise
  }, [api])

  useEffect(() => {
    // Abandon any fetch belonging to the previous identity or token: there is no
    // AbortController on the client, so the old request is left to resolve into
    // the identity guard above while a fresh one starts here.
    inFlightRef.current = null
    void runFetch()
  }, [identityKey, accessToken, runFetch])

  const refresh = useCallback((): Promise<void> => runFetch(), [runFetch])

  // ── Writes ─────────────────────────────────────────────────────────────────
  // A promise chain, not a queue: the web machine needs an explicit queue only
  // because xstate cannot await. Claims paint immediately; network writes
  // serialize behind this (AC 7). The *durable* queue is a different thing
  // entirely — it holds writes that already failed and outlives this component.
  const chainRef = useRef<Promise<unknown>>(Promise.resolve())

  // Written by the effect at the bottom of this hook. Both the direct write and
  // the retry timer poke the queue through it, which breaks the cycle between
  // "process the queue" and "schedule the next wake-up".
  const processQueueRef = useRef<() => Promise<void>>(() => Promise.resolve())

  const enqueue = useCallback(<Value>(run: () => Promise<Value>): Promise<Value> => {
    const next = chainRef.current.then(run, run)
    chainRef.current = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }, [])

  const runWrite = useCallback(
    async (batch: {
      op: WriteOp
      color: string
      verses: number[]
      token: WriteToken
      captured: Identity
    }): Promise<HighlightWriteOutcome> => {
      const { op, color, verses, token, captured } = batch

      await waitForAuthSettled()

      // The write chain outlives an identity change: `enqueue` serializes behind
      // whatever is in flight, and there is no AbortController, so one hung
      // request can hold a queued batch across a sign-out and a sign-in as
      // somebody else. Below we read the CURRENT token rather than one captured
      // at claim time — deliberately, so a mid-write refresh does not fail the
      // write — which without this guard would issue the departed user's
      // passage under the new user's token, creating or deleting highlights on
      // an account that never asked for them.
      //
      // Compare user ids, not `captured.key`: the key also encodes scope, and a
      // write issued for JHN.3 that settles after the reader moved on to JHN.4
      // is still a legitimate write for JHN.3.
      const isSameUser = identityRef.current.userId === captured.userId
      const accessTokenNow = authRef.current.accessToken

      if (!isSameUser || accessTokenNow === null) {
        // Auth settled with no token, or with a different user: from the caller
        // that issued this batch, both are "you are not signed in". Reverting
        // the paint is a no-op in the user-switch case — the identity change
        // already reset state during render — but stays correct if that reset
        // ever stops covering it.
        setState((prev) =>
          settle(prev, { token, op, color, succeededVerses: [], failedVerses: verses }),
        )
        return {
          status: 'error',
          reason: 'not-signed-in',
          message: NOT_SIGNED_IN_MESSAGE,
          failedVerses: verses,
          succeededVerses: [],
        }
      }

      const release = beginHighlightWrite()
      let attempt: WriteAttempt
      try {
        attempt = await issueWrite({
          api,
          accessToken: accessTokenNow,
          op,
          scope: captured.scope,
          color,
          verses,
        })
      } finally {
        release()
      }

      const { succeededVerses, failedVerses, errors } = attempt

      if (failedVerses.length === 0) {
        setState((prev) => settle(prev, { token, op, color, succeededVerses, failedVerses }))
        void runFetch()
        return { status: 'ok', verses: succeededVerses }
      }

      const reason = worstFailureReason(errors)
      const message = messageForReason(errors, reason)

      // Only `transient` re-queues. `invalid` is a bug in our payload and a
      // retry would fail identically; `auth` is answered by the prompt flow, not
      // by trying again — the grant is invalidated below, so the next tap routes
      // to the just-in-time consent instead.
      //
      // Ownership is re-checked here, not just in `settle`: a verse the user has
      // since re-tapped in another colour must not get a retry scheduled that
      // would repaint the colour they moved away from.
      const queuedVerses = selectOwnedVerses(stateRef.current, retryableVerses(attempt), token)

      // Settle everything the queue is NOT taking: succeeded verses register a
      // reconcile entry, permanently-failed verses have their paint reverted.
      // The queued verses stay claimed under this same token so the eventual
      // retry settles onto the paint it already owns.
      setState((prev) =>
        settle(prev, {
          token,
          op,
          color,
          succeededVerses,
          failedVerses: failedVerses.filter((verse) => !queuedVerses.includes(verse)),
        }),
      )

      if (queuedVerses.length > 0) {
        const pending = enqueuePendingOp(captured.userId, {
          op,
          scope: captured.scope,
          color,
          verses: queuedVerses,
        })
        // Reuse the claim's token rather than minting one: the verses are still
        // painted and still stamped with it, so this is the only way the retry
        // can settle them later.
        if (pending !== null) {
          queueTokens.set(pending.id, token)
        }
        void processQueueRef.current()
      }

      // Exactly one GET per settled batch, success or failure — this is what
      // reconciles a partial success back to server truth. Guarded internally
      // against a scope change or sign-out landing mid-write.
      void runFetch()

      // The ADR 0013 seam. The server just told us this token cannot write
      // highlights, which outranks whatever the optimistic mirror believes — so
      // drop the grant and let the next tap route to the just-in-time prompt
      // instead of failing the same way again.
      if (reason === 'auth' && captured.userId !== null) {
        invalidateGrantedPermission(captured.userId, 'highlights')
      }

      return { status: 'error', reason, message, failedVerses, succeededVerses }
    },
    [api, runFetch, waitForAuthSettled],
  )

  // ── The durable retry loop ─────────────────────────────────────────────────
  const isProcessingQueueRef = useRef(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runQueuedOp = useCallback(
    async (pending: PendingOp): Promise<void> => {
      const currentUserId = identityRef.current.userId
      const accessTokenNow = authRef.current.accessToken
      if (currentUserId === null || accessTokenNow === null) {
        // Signed out, or the token has not arrived yet. Leave the op on disk and
        // let the next identity/token change restart the loop.
        return
      }

      const release = beginHighlightWrite()
      let attempt: WriteAttempt
      try {
        attempt = await issueWrite({
          api,
          accessToken: accessTokenNow,
          op: pending.op,
          scope: pending.scope,
          color: pending.color,
          verses: pending.verses,
        })
      } finally {
        release()
      }

      // A sign-out (or an explicit discard) between issuing and settling bumps
      // the generation. Whatever came back belongs to the departed session: do
      // not settle it, and above all do not re-queue it onto the next account.
      if (!isCurrentGeneration(pending.generation)) {
        return
      }

      const { succeededVerses, failedVerses, errors } = attempt
      const token = tokenForPendingOp(pending)
      const reason = failedVerses.length === 0 ? null : worstFailureReason(errors)
      const retryVerses = retryableVerses(attempt)

      // `settle` is guarded on ownership, so a chapter change or a newer tap on
      // these verses makes this a no-op rather than a mispaint.
      setState((prev) =>
        settle(prev, {
          token,
          op: pending.op,
          color: pending.color,
          succeededVerses,
          failedVerses: failedVerses.filter((verse) => !retryVerses.includes(verse)),
        }),
      )

      if (retryVerses.length > 0) {
        retainPendingVerses(currentUserId, pending.id, retryVerses)
        reschedulePendingOp(currentUserId, pending.id)
      } else {
        completePendingOp(currentUserId, pending.id)
        queueTokens.delete(pending.id)
      }

      if (reason === 'invalid') {
        // A bug in our payload, not the network. Nobody is awaiting this retry,
        // so its return value is the log — the user cannot act on it either way.
        console.error(
          '[YouVersion SDK] Queued highlight write rejected and dropped:',
          messageForReason(errors, reason),
        )
      }

      // Same ADR 0013 seam as the direct write. There is no caller to hand the
      // outcome to here, so invalidating the grant IS the hand-off: the next tap
      // gates to the just-in-time permission prompt instead of failing again.
      if (reason === 'auth') {
        invalidateGrantedPermission(currentUserId, 'highlights')
      }

      void runFetch()
    },
    [api, runFetch],
  )

  const scheduleQueueRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    const due = nextPendingAttemptAt(identityRef.current.userId)
    if (due === null) {
      return
    }
    retryTimerRef.current = setTimeout(
      () => {
        retryTimerRef.current = null
        void processQueueRef.current()
      },
      Math.max(0, due - Date.now()),
    )
  }, [])

  const processQueue = useCallback(async (): Promise<void> => {
    if (isProcessingQueueRef.current) {
      return
    }
    isProcessingQueueRef.current = true
    try {
      for (;;) {
        const currentUserId = identityRef.current.userId
        if (currentUserId === null || authRef.current.accessToken === null) {
          break
        }
        const pending = peekDuePendingOp(currentUserId)
        if (pending === null) {
          break
        }
        // Through the same promise chain as a direct write, so a queued remove
        // can never overtake the apply the user just issued for the same verse.
        await enqueue(() => runQueuedOp(pending))
        // `runQueuedOp` bails without touching the queue when auth vanished
        // mid-flight or the generation moved. Without this the head would stay
        // due forever and spin.
        if (peekDuePendingOp(currentUserId)?.id === pending.id) {
          break
        }
      }
    } finally {
      isProcessingQueueRef.current = false
      scheduleQueueRetry()
    }
  }, [enqueue, runQueuedOp, scheduleQueueRetry])

  useEffect(() => {
    processQueueRef.current = processQueue
  }, [processQueue])

  // Replay on launch, and whenever a token or a user arrives. Keyed on
  // `identityKey` so a discard (which bumps the generation) also re-runs and
  // finds nothing left to do.
  useEffect(() => {
    void processQueue()
  }, [identityKey, accessToken, processQueue])

  useEffect(
    () => () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    },
    [],
  )

  const startWrite = useCallback(
    (op: WriteOp, rawColor: string, rawVerses: number[]): Promise<HighlightWriteOutcome> => {
      const captured = identityRef.current
      const color = rawColor.toLowerCase()

      // Three rejections happen before any paint and must not touch state at
      // all. Distinct from the token-loading hold above: holding means
      // "genuinely signed in, token not here yet" (paint and wait); rejecting
      // here means there is no user or no valid request to make.
      if (captured.userId === null) {
        return Promise.resolve({
          status: 'error',
          reason: 'not-signed-in',
          message: NOT_SIGNED_IN_MESSAGE,
          failedVerses: normalizeVerseSelection(rawVerses),
          succeededVerses: [],
        })
      }

      if (!isHighlightColor(color)) {
        return Promise.resolve({
          status: 'error',
          reason: 'invalid',
          message: INVALID_COLOR_MESSAGE,
          failedVerses: normalizeVerseSelection(rawVerses),
          succeededVerses: [],
        })
      }

      // A remove targets what the user can SEE in that color, optimistic paint
      // included. A DELETE carries a passage id and no color, so removing yellow
      // across a selection that also holds a blue verse would otherwise destroy
      // the blue one. Guarded on `userId` and not `isAuthenticated`, because
      // during the token-loading window highlights are painted from cache while
      // `isAuthenticated` is still false.
      const verses =
        op === 'remove'
          ? selectVersesInColor(stateRef.current, normalizeVerseSelection(rawVerses), color)
          : normalizeVerseSelection(rawVerses)

      if (verses.length === 0) {
        return Promise.resolve({ status: 'noop' })
      }

      // Paint synchronously, before the promise is returned.
      const token = createWriteToken(op)
      const claimColor = op === 'apply' ? color : null
      setState((prev) => claim(prev, verses, token, claimColor))

      // Advance the ref with it. The effect that syncs `stateRef` only runs
      // after a render, so a second write issued in the same tick — a toggle
      // that applies and removes inside one handler — would otherwise select
      // against the pre-claim paint, no-op, and strand what the apply painted.
      // Chaining off `stateRef.current` instead of capturing the updater's
      // result keeps the updater pure (React may invoke it twice) and computes
      // the same thing React will: the same claims, in the same order, over the
      // same committed state.
      stateRef.current = claim(stateRef.current, verses, token, claimColor)

      // A newer tap on these verses supersedes anything the queue still owes for
      // them. The overlay's ownership token already protects what the user SEES;
      // this protects the server from a stale retry landing after this write.
      supersedePendingVerses(captured.userId, verses)

      return enqueue(() => runWrite({ op, color, verses, token, captured }))
    },
    [enqueue, runWrite],
  )

  const apply = useCallback(
    (color: string, verses: number[]) => startWrite('apply', color, verses),
    [startWrite],
  )

  const remove = useCallback(
    (color: string, verses: number[]) => startWrite('remove', color, verses),
    [startWrite],
  )

  const highlights = useMemo(() => selectHighlights(renderedState), [renderedState])

  return {
    highlights,
    scope,
    isRefreshing,
    error,
    hasPendingOperations: queueSnapshot.hasPending,
    refresh,
    apply,
    remove,
  }
}

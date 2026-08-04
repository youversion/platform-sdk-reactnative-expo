import type { Highlight } from '@youversion/platform-core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AuthPermission } from '../auth'
import { useYVAuthOptional } from '../auth'
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
  selectVersesInColor,
  serverUpdated,
  settle,
  versesInRun,
  type OptimisticState,
  type WriteOp,
  type WriteToken,
} from './optimistic'

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
      /** Did not land, and any optimistic paint for them has been reverted. */
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

/**
 * Should the highlights GET be mounted at all?
 *
 * Gated on what the app **requested** (`AuthConfig.permissions`), not on what the
 * user granted, so an app that never asked for highlights issues no request.
 *
 * **Do not tighten this to a grant check that treats unknown as denied.** A user
 * whose grants aren't known would silently stop seeing their existing highlights;
 * only a *known* denial may skip the fetch.
 */
export function shouldFetchHighlights(requested: readonly AuthPermission[]): boolean {
  return requested.includes('highlights')
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
    `[YouVersion SDK] Signed in but no user id is available, so highlights cannot be cached. Highlights still load from the network; the instant-mount cache is disabled for this session.`,
  )
}

type Identity = { key: string; scope: HighlightScope; userId: string | null }

function identityKeyFor(userId: string | null, scope: HighlightScope): string {
  return `${userId ?? '<anonymous>'}|${scope.versionId}|${scope.book}|${scope.chapter}`
}

function initialStateFor(scope: HighlightScope, userId: string | null): OptimisticState {
  const cached = userId === null ? null : getCachedHighlights(userId, scope)
  return createOptimisticState({
    scope,
    userId,
    serverColors: cached === null ? {} : deriveServerColors(cached, scope),
  })
}

function sameIdentity(state: OptimisticState, identity: Identity): boolean {
  return identityKeyFor(state.userId, state.scope) === identity.key
}

/**
 * Instant, optimistic, self-healing highlight state for one chapter.
 *
 * Paints from the MMKV cache synchronously on first render, applies and removes
 * optimistically, reconciles against the server, and reverts what fails. This is
 * the only optimistic layer in the stack — the web reader's controlled
 * `highlights` prop is pure projection.
 *
 * Requires `auth` to be configured on `YouVersionProvider`; with no auth
 * configured it behaves exactly as signed out. It also requires `highlights` in
 * that config's `permissions` — without it no GET is ever issued (see
 * {@link shouldFetchHighlights}), so `highlights` stays whatever the cache holds.
 */
export function useHighlights(options: UseHighlightsOptions): UseHighlightsResult {
  const { appKey, apiHost, installationId } = useYouVersion()
  const auth = useYVAuthOptional()

  const accessToken = auth?.accessToken ?? null
  const isAuthLoading = auth?.isLoading ?? false
  const userId = auth?.userInfo?.id ?? null
  // Config, not state: effectively constant for the life of the provider. Read
  // through the closure rather than a ref so a change still re-runs the fetch
  // effect below (`runFetch` is one of its deps).
  const canFetchHighlights = shouldFetchHighlights(auth?.requestedPermissions ?? [])

  const scope = useMemo<HighlightScope>(
    () => ({ versionId: options.versionId, book: options.book, chapter: options.chapter }),
    [options.versionId, options.book, options.chapter],
  )

  const api = useMemo<HighlightsApi>(
    () => createHighlightsApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )

  const currentIdentityKey = identityKeyFor(userId, scope)

  // AC 1 — the synchronous cache read. This is only correct on a cold start
  // because AuthProvider seeds `userInfo` from its own useState initializer
  // (`loadCachedUserInfo()`), so `userInfo.id` already exists on first render.
  // Load-bearing coupling: if that seeding ever goes async, instant mount goes
  // with it.
  const [state, setState] = useState<OptimisticState>(() => initialStateFor(scope, userId))
  const [identityKey, setIdentityKey] = useState(currentIdentityKey)
  const [error, setError] = useState<HighlightsFetchError | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Reset during render rather than in an effect: an effect would leave one
  // frame where the previous chapter's overlay paints over the new chapter's
  // verse numbers. This is React's documented "adjust state when props change"
  // pattern — the re-render happens before anything is committed to the screen.
  let renderedState = state
  if (identityKey !== currentIdentityKey) {
    renderedState = initialStateFor(scope, userId)
    setIdentityKey(currentIdentityKey)
    setState(renderedState)
    setError(null)
  }

  // Latest-value refs for the async layer. Seeded on mount (the fetch effect
  // below runs on the same commit and must see real values), then re-synced by
  // the effect that follows. Async continuations read these rather than closing
  // over one render's values.
  const identityRef = useRef<Identity>({ key: currentIdentityKey, scope, userId })
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
    identityRef.current = { key: currentIdentityKey, scope, userId }
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
    // The app never asked for `highlights`, so a GET could only ever 403. Sits
    // above the in-flight dedup deliberately: when this is false nothing was
    // ever started, so there is nothing to join or to clear.
    if (!canFetchHighlights) {
      return Promise.resolve()
    }

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
  }, [api, canFetchHighlights])

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
  // serialize behind this (AC 7).
  const chainRef = useRef<Promise<unknown>>(Promise.resolve())

  const enqueue = useCallback((run: () => Promise<HighlightWriteOutcome>) => {
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

      const succeededVerses: number[] = []
      const failedVerses: number[] = []
      const errors: HighlightsApiError[] = []

      // One request per unit, each covering the verses it is responsible for.
      // Apply collapses contiguous verses into a single ranged POST per run —
      // [16,17,18,20] is two requests, not four. Remove issues one DELETE per
      // verse, never a range, because range DELETE is unsupported server-side;
      // if that is ever confirmed to work, this ternary is the only call site
      // that changes.
      const units =
        op === 'apply'
          ? collapseVerseRuns(verses).map((run) => ({
              passageId: formatPassageId(captured.scope.book, captured.scope.chapter, run),
              verses: versesInRun(run),
            }))
          : verses.map((verse) => ({
              passageId: formatPassageId(captured.scope.book, captured.scope.chapter, {
                start: verse,
                end: verse,
              }),
              verses: [verse],
            }))

      const results = await Promise.all(
        units.map((unit) =>
          op === 'apply'
            ? api.createHighlight(accessTokenNow, {
                version_id: captured.scope.versionId,
                passage_id: unit.passageId,
                color,
              })
            : api.deleteHighlight(accessTokenNow, unit.passageId, {
                version_id: captured.scope.versionId,
              }),
        ),
      )

      units.forEach((unit, index) => {
        const result = results[index]
        // `results` is 1:1 with `units`, so `undefined` is unreachable — treat
        // it as a failure rather than silently counting it as a success.
        if (result !== undefined && result.ok) {
          succeededVerses.push(...unit.verses)
          return
        }
        failedVerses.push(...unit.verses)
        if (result !== undefined) {
          errors.push(result.error)
        }
      })

      setState((prev) => settle(prev, { token, op, color, succeededVerses, failedVerses }))

      // Exactly one GET per settled batch, success or failure — this is what
      // reconciles a partial success back to server truth. Guarded internally
      // against a scope change or sign-out landing mid-write.
      void runFetch()

      if (failedVerses.length === 0) {
        return { status: 'ok', verses: succeededVerses }
      }

      const reasons = errors.map(classifyApiError)
      const reason = reasons.reduce<HighlightWriteReason>(
        (worst, candidate) => (REASON_RANK[candidate] > REASON_RANK[worst] ? candidate : worst),
        'transient',
      )
      const message =
        errors.find((candidate) => classifyApiError(candidate) === reason)?.message ??
        'Highlight write failed.'

      return { status: 'error', reason, message, failedVerses, succeededVerses }
    },
    [api, runFetch, waitForAuthSettled],
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

  return { highlights, scope, isRefreshing, error, refresh, apply, remove }
}

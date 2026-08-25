import type { Highlight } from '@youversion/platform-core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'

import type { AccessTokenResult, AuthPermission } from '../auth'
import { useYVAuthOptional } from '../auth'
import type { HookOverrides } from '../hook-overrides'
import { useYouVersion } from '../use-youversion'
import { createHighlightsApi, type HighlightsApi, type HighlightsApiError } from './api'
import {
  deriveServerColors,
  getCachedHighlights,
  mergeCachedHighlights,
  setCachedHighlights,
} from './cache'
import { claimWrites } from './claims'
import { isHighlightColor, NOT_SIGNED_IN_MESSAGE, type HighlightScope } from './constants'
import { isValidHighlightHex } from './paint-projection'
import { notifyDrain } from './drain-signals'
import {
  applyQueuedWrites,
  confirm,
  createOptimisticState,
  normalizeVerseSelection,
  paint,
  restore,
  selectHighlights,
  selectVersesInColor,
  serverUpdated,
  toWriteUnits,
  type OptimisticState,
  type WriteOp,
} from './optimistic'
import { dropWrites, enqueueWrites, getQueuedWrites, onWritesDropped } from './queue'

export type UseHighlightsOptions = {
  versionId: number
  book: string
  chapter: string
  /**
   * When false, skip Highlights Refresh and do not persist this scope's cache.
   * `highlights` is `[]`, ignoring whatever the dummy scope's cache holds.
   * Default true. Paint-only surfaces pass false for a dummy Highlight Scope
   * while VOTD (or invalid USFM) has no real scope.
   */
  enabled?: boolean
}

export type HighlightWriteReason = 'not-signed-in' | 'auth' | 'transient' | 'invalid'

export type HighlightWriteOutcome =
  | { status: 'ok'; verses: number[] }
  /**
   * Could not reach the server. The paint stands and the write is persisted as a
   * Queued Write; a point-in-time signal at the tap, not a standing state.
   *
   * It therefore repeats. Every tap on a verse that is still parked resolves
   * `queued` again — this reports the write the caller just made, not the
   * verse's queue state, and nothing here separates a first park from a later
   * one. Two reasons it does not: a batch can mix a parked verse with fresh
   * ones, so an honest answer would have to be a per-verse split of `verses`;
   * and a verse parked yellow then tapped green is a new write on a parked
   * verse, which "repeat" would describe wrongly. A caller that wants to say
   * "saved offline" once holds that in its own state.
   */
  | { status: 'queued'; verses: number[] }
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
  /**
   * Per-verse passage ids, ascending (e.g. `JHN.3.16`). Feed straight into a
   * controlled reader. Book codes keep the case of the `book` they were
   * requested for — the reader matches on them case-sensitively.
   */
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

const INVALID_COLOR_MESSAGE =
  'Unsupported highlight color. Use one of the five YouVersion highlight swatches.'

const TOKEN_REFRESH_FAILED_MESSAGE =
  'Could not refresh the session token. Retry when the network recovers.'

const QUEUE_PERSIST_FAILED_MESSAGE =
  'Could not record the highlight for sending. Retry in a moment.'

const UNEXPECTED_WRITE_FAILURE_MESSAGE = 'The highlight write could not be completed.'

/**
 * `auth` wins (it changes what the user must do); retrying `invalid` is
 * pointless. `not-signed-in` is ranked but unreachable here — it is never
 * produced by {@link classifyApiError}, only constructed directly, so it can
 * never be one of several competing failures in a batch.
 */
const REASON_RANK = {
  'not-signed-in': 4,
  auth: 3,
  invalid: 2,
  transient: 1,
} satisfies Record<HighlightWriteReason, number>

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
    '[YouVersion SDK] Signed in but no user id is available, so highlights cannot be cached. ' +
      'Highlights still load from the network; the instant-mount cache is disabled for this session.',
  )
}

type Identity = { key: string; scope: HighlightScope; userId: string | null }

function identityKeyFor(userId: string | null, scope: HighlightScope): string {
  return `${userId ?? '<anonymous>'}|${scope.versionId}|${scope.book}|${scope.chapter}`
}

/**
 * The cache already holds unsent writes, so re-applying the queue is a repair:
 * a process that died between the two MMKV writes would otherwise come back
 * owing a write it does not show.
 */
function initialStateFor(scope: HighlightScope, userId: string | null): OptimisticState {
  const cached = userId === null ? null : getCachedHighlights(userId, scope)
  const colors = cached === null ? {} : deriveServerColors(cached, scope)

  if (userId !== null) {
    applyQueuedWrites(colors, getQueuedWrites(userId, scope))
  }

  return createOptimisticState({ scope, userId, colors })
}

function sameIdentity(state: OptimisticState, identity: Identity): boolean {
  return identityKeyFor(state.userId, state.scope) === identity.key
}

/**
 * A settling write must write the cache for the scope it was MADE in, which is
 * not always the scope on screen.
 *
 * The render-path cache write covers only the current scope, so a write that
 * settles after the reader has moved on leaves its own chapter holding whatever
 * the cache last recorded. For a refusal that is paint the server said no to:
 * the entry is dropped, nothing repairs the cache, and the next mount of that
 * chapter paints the refused color until a successful GET happens to correct it.
 * {@link landInCache} and {@link revertInCache} close that, mirroring `land` and
 * `revert` in `drain.ts` — which already had to solve it for scopes with no
 * mounted hook at all.
 *
 * Both filter on `local === color`, the same guard `dropWrites` applies, so a
 * verse the user has since re-tapped keeps its newer intent. Both are called
 * BEFORE the entry is dropped, as the drain does: a crash between the two must
 * leave the write still owed rather than leave a refused paint in the cache with
 * nothing left to correct it.
 */
function landInCache(
  userId: string,
  scope: HighlightScope,
  verses: readonly number[],
  color: string | null,
): void {
  const owed = getQueuedWrites(userId, scope)
  const landed = verses.filter((verse) => owed[verse]?.local === color)
  if (landed.length > 0) {
    mergeCachedHighlights(userId, scope, landed, color)
  }
}

/** {@link landInCache}'s counterpart: back to each entry's `server` side. */
function revertInCache(
  userId: string,
  scope: HighlightScope,
  verses: readonly number[],
  color: string | null,
): void {
  const owed = getQueuedWrites(userId, scope)
  const byServer = new Map<string | null, number[]>()
  for (const verse of verses) {
    const entry = owed[verse]
    if (entry === undefined || entry.local !== color) {
      continue
    }
    const group = byServer.get(entry.server)
    if (group === undefined) {
      byServer.set(entry.server, [verse])
    } else {
      group.push(verse)
    }
  }
  for (const [server, group] of byServer) {
    mergeCachedHighlights(userId, scope, group, server)
  }
}

/**
 * How the token-loading hold ended — auth answered, or the hook unmounted while
 * a write was still waiting on it. See `authWaitersRef`.
 */
type AuthSettleOutcome = 'settled' | 'aborted'

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
function shouldRunLiveHighlightWork(overrides: HookOverrides | undefined): boolean {
  return (
    overrides?.useHighlights === undefined && overrides?.useHighlightPermissionFlow === undefined
  )
}

function useHighlightsImplementation(
  options: UseHighlightsOptions,
  live: boolean,
): UseHighlightsResult {
  const { versionId, book, chapter, enabled = true } = options
  const { appKey, apiHost, installationId } = useYouVersion()
  const auth = useYVAuthOptional()

  const accessToken = auth?.accessToken ?? null
  const isAuthLoading = auth?.isLoading ?? false
  const userId = auth?.userInfo?.id ?? null
  // Config, not state: effectively constant for the life of the provider. Read
  // through the closure rather than a ref so a change still re-runs the fetch
  // effect below (`runFetch` is one of its deps). An override still mounts this
  // hook (rules of hooks) but must not GET, write, notify the drain, or persist cache.
  const canFetchHighlights =
    live && enabled && shouldFetchHighlights(auth?.requestedPermissions ?? [])
  const getAccessToken = auth?.getAccessToken ?? null

  const scope = useMemo<HighlightScope>(
    () => ({ versionId, book, chapter }),
    [versionId, book, chapter],
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
  const authRef = useRef({ accessToken, isAuthLoading, getAccessToken })

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
  //
  // Unmounting is a third exit, and it carries its own marker. A plain flush on
  // unmount would resume `runWrite` against a token that is STILL null, which
  // classifies as `not-signed-in` and reverts — deleting the queue entry for a
  // write the user made and the server never saw. That is data loss. Not
  // flushing at all is the other trap: `runWrite` never resumes, the
  // `.finally(release)` in `startWrite` never runs, and the verse's claim in
  // `claims.ts` survives until relaunch — which makes the drain skip those
  // verses for the whole session while re-arming its timer against them. The
  // `'aborted'` marker is the only exit that keeps both the entry and the claim
  // honest.
  const authWaitersRef = useRef<((outcome: AuthSettleOutcome) => void)[]>([])
  const isUnmountedRef = useRef(false)

  // Runs after EVERY render, and must stay declared above the fetch effect:
  // effects fire in declaration order, so this is what guarantees `runFetch`
  // reads the identity and token of the render that scheduled it.
  useEffect(() => {
    identityRef.current = { key: currentIdentityKey, scope, userId }
    stateRef.current = renderedState
    authRef.current = { accessToken, isAuthLoading, getAccessToken }

    if (accessToken !== null && userId === null) {
      warnMissingUserId()
    }

    if (accessToken === null && isAuthLoading) {
      return
    }
    const waiters = authWaitersRef.current
    authWaitersRef.current = []
    for (const resolve of waiters) {
      resolve('settled')
    }
  })

  // Mount-only, for its cleanup alone: a write parked in the hold has no other
  // way out once this hook is gone, and leaving it there strands its claim.
  // The body's reset matters under StrictMode's mount/cleanup/mount cycle:
  // without it the simulated unmount latches the flag and every later write
  // that needs the hold aborts to the queue while the hook is still mounted.
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
      const waiters = authWaitersRef.current
      authWaitersRef.current = []
      for (const resolve of waiters) {
        resolve('aborted')
      }
    }
  }, [])

  const waitForAuthSettled = useCallback((): Promise<AuthSettleOutcome> => {
    const current = authRef.current
    if (current.accessToken !== null || !current.isAuthLoading) {
      return Promise.resolve('settled')
    }
    // The flush above only reaches a write that was already waiting. A write
    // still queued behind another one reaches this point AFTER the unmount, with
    // nothing left to render, so it would wait on a resolve that can never come.
    // Checked here rather than at the top: a write that does not need the hold at
    // all is unaffected by the unmount and still goes out.
    if (isUnmountedRef.current) {
      return Promise.resolve('aborted')
    }
    return new Promise<AuthSettleOutcome>((resolve) => {
      authWaitersRef.current.push(resolve)
    })
  }, [])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const inFlightRef = useRef<Promise<void> | null>(null)

  const runFetch = useCallback((): Promise<void> => {
    // The app never asked for `highlights`, so a GET could only ever 403.
    // Deliberately does not clear `isRefreshing`: the exposed value is derived
    // against this same gate below, so a mid-fetch flip cannot strand it.
    if (!canFetchHighlights) {
      return Promise.resolve()
    }
    if (!enabled) {
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
        // Ahead of the identity guard: the network is up regardless of which
        // scope this answer belongs to.
        if (result.ok) {
          notifyDrain('service-reached')
        }
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
        const serverColors = deriveServerColors(result.value.data, captured.scope)
        const queued =
          captured.userId === null ? {} : getQueuedWrites(captured.userId, captured.scope)
        setState((prev) =>
          sameIdentity(prev, captured) ? serverUpdated(prev, serverColors, queued) : prev,
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
  }, [api, canFetchHighlights, enabled])

  useEffect(() => {
    // Abandon any fetch belonging to the previous identity or token: there is no
    // AbortController on the client, so the old request is left to resolve into
    // the identity guard above while a fresh one starts here.
    inFlightRef.current = null
    void runFetch()
  }, [identityKey, accessToken, runFetch])

  const refresh = useCallback((): Promise<void> => runFetch(), [runFetch])

  // Highlights Refresh when the app returns to active — same rule as auth
  // refresh and the Highlight Write Queue drain. Do not clear inFlightRef:
  // foreground should join an in-flight GET, not abandon it.
  useEffect(() => {
    if (!live) {
      return
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runFetch()
      }
    })
    return () => subscription.remove()
  }, [live, runFetch])

  // The drain gave up on a write this reader is still painting. Nothing remounts,
  // so the un-paint arrives here (ADR 0018).
  useEffect(() => {
    if (!live) {
      return
    }
    return onWritesDropped((dropped) => {
      const captured = identityRef.current
      if (identityKeyFor(dropped.userId, dropped.scope) !== captured.key) {
        return
      }
      setState((prev) =>
        sameIdentity(prev, captured)
          ? restore(prev, { restored: dropped.restored, cleared: dropped.cleared })
          : prev,
      )
    })
  }, [live])

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
      captured: Identity
    }): Promise<HighlightWriteOutcome> => {
      const { op, color, verses, captured } = batch
      const paintedColor = op === 'apply' ? color : null

      /** Undoes verses the server refused, skipping any the user has re-tapped. */
      const revert = (rejected: number[]): void => {
        if (captured.userId === null || rejected.length === 0) {
          return
        }
        // The cache first, for the write's OWN scope — the setState below is
        // guarded on the current identity, so on its own it repairs nothing once
        // the reader has moved on. See {@link revertInCache}.
        revertInCache(captured.userId, captured.scope, rejected, paintedColor)
        const { restored, cleared } = dropWrites({
          userId: captured.userId,
          scope: captured.scope,
          verses: rejected,
          color: paintedColor,
        })
        setState((prev) =>
          sameIdentity(prev, captured) ? restore(prev, { restored, cleared }) : prev,
        )
      }

      if ((await waitForAuthSettled()) === 'aborted') {
        // Unmounted with the token still missing. The paint went with the
        // component, the entry stands, and the drain owes the server this write
        // — so it is a park, not a failure. Deliberately does NOT run the
        // not-signed-in classification below, which would revert and delete the
        // entry (see `authWaitersRef`). Returning frees the claim through
        // `startWrite`'s `.finally(release)`, which is what lets the drain pick
        // these verses up in this same session.
        notifyDrain('write-parked')
        return { status: 'queued', verses }
      }

      // Fresh token resolved in the send path, not at tap time — `startWrite`
      // has already painted. A failed refresh must stop the write here: an
      // expired token 401s, classifies as `auth`, and has the permission flow
      // drop a valid grant (ADR 0016). No accessor means no auth is configured,
      // which this hook treats exactly as signed out.
      const getToken = authRef.current.getAccessToken
      const tokenResult: AccessTokenResult = getToken
        ? await getToken()
        : { status: 'unavailable', reason: 'signed-out' }

      // The write chain outlives an identity change: `enqueue` serializes behind
      // whatever is in flight, and there is no AbortController, so one hung
      // request can hold a queued batch across a sign-out and a sign-in as
      // somebody else. Below we use the CURRENT token rather than one captured
      // at claim time — deliberately, so a mid-write refresh does not fail the
      // write — which without this guard would issue the departed user's
      // passage under the new user's token, creating or deleting highlights on
      // an account that never asked for them.
      //
      // Compare user ids, not `captured.key`: the key also encodes scope, and a
      // write issued for JHN.3 that settles after the reader moved on to JHN.4
      // is still a legitimate write for JHN.3.
      //
      // The token's own `userId` is the authority, not `identityRef`: the
      // provider writes token and identity together, while `identityRef` is
      // synced from a passive effect a render later. A sign-in as somebody else
      // landing while this awaited above moves the token first, so an
      // identityRef-only check would pass and send under the new user's
      // credentials. The lagging check stays because the branch below reuses
      // `isSameUser` to tell a user switch from a plain failed refresh, and
      // only that one reports `transient`.
      const isSameUser =
        identityRef.current.userId === captured.userId &&
        (tokenResult.status !== 'ok' || tokenResult.userId === captured.userId)

      if (!isSameUser || tokenResult.status === 'unavailable') {
        // Revert the paint either way — a no-op in the user-switch case, where
        // the render-time identity reset already covered it.
        revert(verses)
        // The session is intact and no request went out, so `transient` — never
        // `auth` (drops the grant) or `not-signed-in` (prompts sign-in).
        if (
          isSameUser &&
          tokenResult.status === 'unavailable' &&
          tokenResult.reason === 'refresh-failed'
        ) {
          return {
            status: 'error',
            reason: 'transient',
            message: TOKEN_REFRESH_FAILED_MESSAGE,
            failedVerses: verses,
            succeededVerses: [],
          }
        }
        return {
          status: 'error',
          reason: 'not-signed-in',
          message: NOT_SIGNED_IN_MESSAGE,
          failedVerses: verses,
          succeededVerses: [],
        }
      }

      const accessTokenNow = tokenResult.token
      // Re-read at send time, not tap time: a write is already on the chain by
      // the time a later tap can cancel or supersede its entry. A verse the queue
      // no longer wants in this color needs no request — the end state it asked
      // for is one the server already has, or one a newer write will set.
      const owed = getQueuedWrites(captured.userId, captured.scope)
      const sendable = verses.filter((verse) => owed[verse]?.local === paintedColor)
      if (sendable.length === 0) {
        return { status: 'noop' }
      }

      const succeededVerses: number[] = []
      const queuedVerses: number[] = []
      const failedVerses: number[] = []
      const errors: HighlightsApiError[] = []

      const units = toWriteUnits(captured.scope, sendable, paintedColor)

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
        // A write the server never saw is owed, not lost: its entry and its paint
        // both stand, and there is nothing to settle. Only a refusal — 401, 403,
        // any other 4xx — takes the paint back.
        if (result !== undefined && classifyApiError(result.error) === 'transient') {
          queuedVerses.push(...unit.verses)
          return
        }
        failedVerses.push(...unit.verses)
        if (result !== undefined) {
          errors.push(result.error)
        }
      })

      if (succeededVerses.length > 0 && captured.userId !== null) {
        // Same reason as the revert path, same order: the paint this write asked
        // for belongs in ITS scope's cache, which the render-path write covers
        // only while the reader is still on that chapter.
        landInCache(captured.userId, captured.scope, succeededVerses, paintedColor)
        dropWrites({
          userId: captured.userId,
          scope: captured.scope,
          verses: succeededVerses,
          color: paintedColor,
        })
        setState((prev) =>
          sameIdentity(prev, captured)
            ? confirm(prev, { op, color, verses: succeededVerses })
            : prev,
        )
      }
      revert(failedVerses)

      // The drain owns it from here; this hook will not retry it.
      if (queuedVerses.length > 0) {
        notifyDrain('write-parked')
      }

      // One GET per write that reached the server; a queued one changed nothing
      // there and has nothing to reconcile.
      if (succeededVerses.length > 0 || failedVerses.length > 0) {
        void runFetch()
      }

      // A refusal outranks a park: `useHighlightPermissionFlow` branches on `reason`.
      if (failedVerses.length > 0) {
        const reasons = errors.map(classifyApiError)
        const reason = reasons.reduce<HighlightWriteReason>(
          (worst, candidate) => (REASON_RANK[candidate] > REASON_RANK[worst] ? candidate : worst),
          'transient',
        )
        const message =
          errors.find((candidate) => classifyApiError(candidate) === reason)?.message ??
          'Highlight write failed.'

        return { status: 'error', reason, message, failedVerses, succeededVerses }
      }

      if (queuedVerses.length > 0) {
        return { status: 'queued', verses: queuedVerses }
      }

      return { status: 'ok', verses: succeededVerses }
    },
    [api, runFetch, waitForAuthSettled],
  )

  const startWrite = useCallback(
    (op: WriteOp, rawColor: string, rawVerses: number[]): Promise<HighlightWriteOutcome> => {
      if (!live) {
        return Promise.resolve({ status: 'noop' })
      }

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

      if (!isValidHighlightHex(color)) {
        return Promise.resolve({
          status: 'error',
          reason: 'invalid',
          message: INVALID_COLOR_MESSAGE,
          failedVerses: normalizeVerseSelection(rawVerses),
          succeededVerses: [],
        })
      }

      if (op === 'apply' && !isHighlightColor(color)) {
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

      // Queue before paint: dying between the two leaves a write that is owed
      // but unpainted, which the next mount repairs. The other order leaves one
      // painted that nothing will ever send.
      const paintedColor = op === 'apply' ? color : null
      try {
        enqueueWrites({
          userId: captured.userId,
          scope: captured.scope,
          verses,
          color: paintedColor,
          currentColors: stateRef.current.colors,
        })
      } catch {
        // MMKV refused the entry. Reported here, before any paint and before any
        // claim, because this is the last point where nothing has happened yet.
        // `enqueueWrites` must NOT swallow it instead: that would let the paint
        // go down with no entry behind it — the one state queue-first ordering
        // exists to prevent.
        return Promise.resolve({
          status: 'error',
          reason: 'transient',
          message: QUEUE_PERSIST_FAILED_MESSAGE,
          failedVerses: verses,
          succeededVerses: [],
        })
      }
      setState((prev) => paint(prev, verses, paintedColor))

      // Advance the ref with it. The effect that syncs `stateRef` only runs
      // after a render, so a second write issued in the same tick — a toggle
      // that applies and removes inside one handler — would otherwise select
      // against the pre-paint colors, no-op, and strand what the apply painted.
      // Chaining off `stateRef.current` instead of capturing the updater's
      // result keeps the updater pure (React may invoke it twice) and computes
      // the same thing React will: the same writes, in the same order, over the
      // same committed state.
      stateRef.current = paint(stateRef.current, verses, paintedColor)

      // Claimed for the life of the write. The entry stays in MMKV until it
      // settles, so without this the drain would read it as owed and send it
      // twice.
      const release = claimWrites(captured.userId, captured.scope, verses)
      return (
        enqueue(() => runWrite({ op, color, verses, captured }))
          .finally(release)
          // `apply` and `remove` resolve an outcome; they never reject, and every
          // consumer doc says so loudly enough that nothing wraps them in a
          // `try`/`catch`. The realistic throw is MMKV refusing a write from the
          // queue or the cache repair deep inside `runWrite`, so this is what
          // keeps that promise true — including for whatever throws next.
          .catch(
            (): HighlightWriteOutcome => ({
              status: 'error',
              reason: 'transient',
              message: UNEXPECTED_WRITE_FAILURE_MESSAGE,
              failedVerses: verses,
              succeededVerses: [],
            }),
          )
      )
    },
    [enqueue, live, runWrite],
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

  // One place, so no write path can paint without persisting.
  useEffect(() => {
    if (!live || userId === null) {
      return
    }
    if (!enabled) {
      return
    }
    try {
      setCachedHighlights(userId, scope, highlights)
    } catch {
      // The cache is the paint, but it is still only a hint about it: a store
      // that refuses this write costs a slower next mount, and must not take the
      // component rendering the chapter down with it.
    }
  }, [live, userId, scope, highlights, enabled])

  let paintedHighlights = highlights
  if (!enabled) {
    paintedHighlights = []
  }

  return {
    highlights: paintedHighlights,
    scope,
    isRefreshing: isRefreshing && canFetchHighlights && enabled,
    error,
    refresh,
    apply,
    remove,
  }
}

export function useHighlights(options: UseHighlightsOptions): UseHighlightsResult {
  const overrides = useYouVersion().hookOverrides
  const override = overrides?.useHighlights
  const real = useHighlightsImplementation(options, shouldRunLiveHighlightWork(overrides))
  return override?.(options) ?? real
}

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { useYVAuthOptional } from '../auth'
import { NOT_SIGNED_IN_MESSAGE } from './constants'
import {
  HIGHLIGHTS_PERMISSION,
  initialPermissionFlowState,
  permissionFlowReducer,
  scopeKey,
  toWriteReason,
  type PendingHighlight,
  type PermissionFlowError,
  type PermissionFlowEvent,
  type PermissionFlowState,
} from './permission-flow'
import {
  useHighlights,
  type HighlightWriteOutcome,
  type UseHighlightsOptions,
  type UseHighlightsResult,
} from './use-highlights'

export type UseHighlightPermissionFlowResult = {
  /**
   * The underlying {@link useHighlights} result, unmodified — render `highlights`
   * from it, and use its `remove` / `refresh` / `isRefreshing` / `error` as
   * documented. Only `apply` is wrapped, and the wrapper lives on this object,
   * not inside `highlights`.
   */
  highlights: UseHighlightsResult
  /**
   * The consent prompt should be showing. Drive a sheet's `isOpen` from this and
   * wire **every** dismissal path — button, backdrop, pan-down — to
   * {@link decline}, so no dismissal can strand a pending highlight.
   */
  isConfirming: boolean
  /**
   * Apply a highlight, running sign-in and/or consent first if the user is not
   * yet allowed to make it. Resolves once the whole round-trip has finished:
   * with the write's own outcome when one was issued, `noop` when the user
   * abandoned the flow, or an `error` when the flow itself failed.
   */
  apply: (color: string, verses: number[]) => Promise<HighlightWriteOutcome>
  /** The user accepted the consent prompt. No-op unless {@link isConfirming}. */
  confirm: () => void
  /**
   * The user dismissed the consent prompt, by any route. Discards the pending
   * highlight. No-op unless {@link isConfirming}.
   */
  decline: () => void
  /**
   * The last terminal flow failure — a failed permission grant, or a write still
   * refused after the user granted the permission. Cancels and declines are not
   * failures and never appear here. Cleared when a new flow starts or the scope
   * changes.
   */
  flowError: PermissionFlowError | null
}

const FLOW_IN_PROGRESS_MESSAGE =
  'A highlight permission flow is already in progress; this highlight was not applied.'

let hasWarnedMissingAuthConfig = false

/**
 * The only genuine misconfiguration this hook can detect. A missing *permission*
 * is the user flow and must never warn; a missing `auth` **config** means the
 * flow can never do anything, which the developer wants to hear about once.
 */
function warnMissingAuthConfig(): void {
  if (hasWarnedMissingAuthConfig || process.env.NODE_ENV === 'production') {
    return
  }
  hasWarnedMissingAuthConfig = true
  console.warn(
    '[YouVersion SDK] useHighlightPermissionFlow needs `auth` configured on YouVersionProvider. ' +
      'Without it there is no user to sign in and no permission to grant, so highlight writes ' +
      'behave exactly as signed out.',
  )
}

function notSignedInOutcome(verses: number[]): HighlightWriteOutcome {
  return {
    status: 'error',
    reason: 'not-signed-in',
    message: NOT_SIGNED_IN_MESSAGE,
    failedVerses: verses,
    succeededVerses: [],
  }
}

/**
 * Guided highlighting: the two-branch permission flow over {@link useHighlights}.
 *
 * A user who taps a color before signing in, or before granting the `highlights`
 * permission, still gets their highlight — it is held in memory, the missing
 * step runs, and the write goes out on the way back. Mirrors the Swift SDK's
 * `BibleReaderViewModel.addHighlightOrStartPermissionFlow`.
 *
 * The branch point is a **pre-flight cache read**, not a write's 401/403:
 * reason-first would burn a failed round-trip before every first highlight. The
 * `reason: 'auth'` path is the corrective fallback for a cache that turned out
 * to be stale, and it re-prompts exactly once.
 *
 * With no `auth` on `YouVersionProvider` this behaves exactly as signed out (and
 * says so once, in development).
 */
export function useHighlightPermissionFlow(
  options: UseHighlightsOptions,
): UseHighlightPermissionFlowResult {
  const highlights = useHighlights(options)
  const auth = useYVAuthOptional()

  const [state, dispatch] = useReducer(permissionFlowReducer, initialPermissionFlowState)

  // ── Scope-change reset, during render ───────────────────────────────────────
  // Same "adjust state when props change" pattern useHighlights uses, and for
  // the same reason: an effect would leave one frame where a consent sheet for
  // the chapter the reader just left is still open over the new one.
  const currentScopeKey = scopeKey(options)
  const [seenScopeKey, setSeenScopeKey] = useState(currentScopeKey)

  let renderedState = state
  if (seenScopeKey !== currentScopeKey) {
    renderedState = permissionFlowReducer(state, { type: 'RESET' })
    setSeenScopeKey(currentScopeKey)
    dispatch({ type: 'RESET' })
  }

  // ── Latest-value refs for the async layer ──────────────────────────────────
  // Seeded from this render and re-synced after every one. Async continuations
  // read these instead of closing over a single render's values — the flow spans
  // a browser round-trip, across which almost everything can change.
  const stateRef = useRef<PermissionFlowState>(renderedState)
  const authRef = useRef(auth)
  const highlightsRef = useRef(highlights)

  /**
   * Generation token. Bumped when a flow starts and when one is abandoned, so a
   * continuation that resolves late — a browser result arriving after a scope
   * change — can tell it is talking about a flow that no longer exists. The
   * reducer would ignore its event anyway; this is what stops it resolving
   * somebody else's promise.
   */
  const flowIdRef = useRef(0)

  /** The caller awaiting the in-progress flow. Exactly one, since flows are exclusive. */
  const resolveRef = useRef<((outcome: HighlightWriteOutcome) => void) | null>(null)

  // A forced render, used to read auth state that was committed by an action we
  // just awaited (see `nextCommittedRender`).
  const [, bumpRender] = useState(0)
  const renderWaitersRef = useRef<(() => void)[]>([])

  /**
   * Resolve whoever is waiting on a flow that ended without an answer for them —
   * a scope change, or an unmount. Bumps the generation so the continuation that
   * was going to answer them cannot.
   */
  const settleAbandoned = useCallback((): void => {
    const resolve = resolveRef.current
    if (resolve === null) {
      return
    }
    resolveRef.current = null
    flowIdRef.current += 1
    resolve({ status: 'noop' })
  }, [])

  // Mutually recursive continuations (advance → run* → advance), so the runners
  // reach `advance` through a ref instead of a dependency cycle between
  // `useCallback`s that cannot name each other. Filled in by the effect below.
  const runnersRef = useRef({
    advance: (_next: PermissionFlowState, _flowId: number, _pending: PendingHighlight): void => {},
  })

  // Runs after EVERY render.
  useEffect(() => {
    stateRef.current = renderedState
    authRef.current = auth
    highlightsRef.current = highlights

    // `idle` with somebody still waiting means the flow was discarded out from
    // under them (the render-time reset above is the only route that does this
    // without resolving them itself).
    if (renderedState.step === 'idle') {
      settleAbandoned()
    }

    const waiters = renderWaitersRef.current
    renderWaitersRef.current = []
    for (const resolve of waiters) {
      resolve()
    }
  })

  useEffect(
    () => () => {
      // On unmount, settle first (so any flushed continuation finds nothing to
      // answer) and then release the waiters, rather than leaving a caller's
      // promise pending for the lifetime of the app.
      settleAbandoned()
      const waiters = renderWaitersRef.current
      renderWaitersRef.current = []
      for (const resolve of waiters) {
        resolve()
      }
    },
    [settleAbandoned],
  )

  /**
   * Resolves after React has committed a render, so `authRef` reflects state that
   * an action we just awaited set.
   *
   * This is load-bearing, not belt-and-braces. `signIn()` resolves in a
   * microtask; the re-render for the `setState` calls it made is scheduled on a
   * macrotask, so reading auth straight after awaiting it is *guaranteed* to be
   * too early. Forcing a render fixes the ordering rather than hoping for it:
   * React applies every update enqueued before a render begins, and auth's were
   * enqueued before this one.
   */
  const nextCommittedRender = useCallback(
    (): Promise<void> =>
      new Promise<void>((resolve) => {
        renderWaitersRef.current.push(resolve)
        bumpRender((n) => n + 1)
      }),
    [],
  )

  /**
   * Reduce and dispatch in one step, returning the next state synchronously.
   *
   * The mirror into `stateRef` is what makes the hook's own control flow
   * deterministic: a `confirm()` handler must know it moved to `granting` before
   * React re-renders, or a double-tap would mint two data-exchange tokens. Safe
   * because the reducer is pure and React replays the same events in the same
   * order onto the same committed state.
   */
  const send = useCallback((event: PermissionFlowEvent): PermissionFlowState => {
    const next = permissionFlowReducer(stateRef.current, event)
    stateRef.current = next
    dispatch(event)
    return next
  }, [])

  /** Hand the waiting caller their answer, unless this flow has been superseded. */
  const finish = useCallback((flowId: number, outcome: HighlightWriteOutcome): void => {
    if (flowIdRef.current !== flowId) {
      return
    }
    const resolve = resolveRef.current
    resolveRef.current = null
    resolve?.(outcome)
  }, [])

  const runSignIn = useCallback(
    async (pending: PendingHighlight, flowId: number): Promise<void> => {
      const current = authRef.current
      if (current === null) {
        finish(flowId, notSignedInOutcome(pending.verses))
        send({ type: 'RESET' })
        return
      }

      try {
        await current.signIn()
      } catch {
        // `signIn` already recorded the failure on the auth context's `error`.
        // Nothing is rethrown at a caller who asked for a highlight: the read
        // below settles the flow either way, and a cancel and a failure lead to
        // the same place from here.
      }

      await nextCommittedRender()
      if (flowIdRef.current !== flowId) {
        return
      }

      const after = authRef.current
      const next = send({
        type: 'SIGN_IN_DONE',
        signedIn: after?.isAuthenticated ?? false,
        // Signing in can grant the permission on the way through — the grant
        // rides on the OAuth redirect — so this is a real fall-through, not a
        // formality.
        hasPermission: after?.hasPermission(HIGHLIGHTS_PERMISSION) ?? false,
      })
      runnersRef.current.advance(next, flowId, pending)
    },
    [finish, nextCommittedRender, send],
  )

  const runGrant = useCallback(
    async (pending: PendingHighlight, flowId: number): Promise<void> => {
      const current = authRef.current
      if (current === null) {
        finish(flowId, notSignedInOutcome(pending.verses))
        send({ type: 'RESET' })
        return
      }

      // Read from the ref rather than a captured context value: `requestPermissions`
      // closes over the access token, and a refresh mid-flow replaces it.
      const outcome = await current.requestPermissions([HIGHLIGHTS_PERMISSION])
      if (flowIdRef.current !== flowId) {
        return
      }
      const next = send({ type: 'GRANT_RESULT', outcome })
      runnersRef.current.advance(next, flowId, pending)
    },
    [finish, send],
  )

  const runApply = useCallback(
    async (pending: PendingHighlight, flowId: number): Promise<void> => {
      const outcome = await highlightsRef.current.apply(pending.color, pending.verses)
      if (flowIdRef.current !== flowId) {
        return
      }
      const next = send({ type: 'APPLY_RESULT', outcome })

      if (next.step === 'idle') {
        // The write's own outcome is the report — including a terminal auth
        // failure, which `flowError` also carries for a toast.
        finish(flowId, outcome)
        return
      }

      // The only other destination is one corrective re-prompt: the grant we
      // hold is demonstrably not what the server thinks, so drop it before
      // asking again, or the next pre-flight would read the same wrong answer.
      authRef.current?.invalidatePermissions()
      runnersRef.current.advance(next, flowId, pending)
    },
    [finish, send],
  )

  /**
   * Perform whatever the step we just entered requires. `pending` is only needed
   * for the terminal case, where the state no longer carries one; every other
   * step reads its own.
   */
  const advance = useCallback(
    (next: PermissionFlowState, flowId: number, pending: PendingHighlight): void => {
      switch (next.step) {
        case 'idle':
          finish(
            flowId,
            next.error === null
              ? // Abandoned by the user: nothing was written and nothing is
                // wrong, so this is not an error to report to them.
                { status: 'noop' }
              : {
                  status: 'error',
                  reason: toWriteReason(next.error.reason),
                  message: next.error.message,
                  failedVerses: pending.verses,
                  succeededVerses: [],
                },
          )
          return
        case 'signing-in':
          void runSignIn(next.pending, flowId)
          return
        case 'granting':
          void runGrant(next.pending, flowId)
          return
        case 'applying':
          void runApply(next.pending, flowId)
          return
        case 'confirming':
          // Waits for the user: `confirm()` or `decline()` drives it from here.
          return
      }
    },
    [finish, runSignIn, runGrant, runApply],
  )

  // Published after commit rather than assigned during render: a render may be
  // discarded, and nothing calls back into `advance` before a user event anyway.
  useEffect(() => {
    runnersRef.current.advance = advance
  }, [advance])

  /**
   * Open a flow and hand the caller a promise for its eventual outcome. Flows are
   * exclusive — a second one while a browser session is open would mint a second
   * token and, on Android, fail outright — so an overlapping caller is told the
   * write did not happen rather than being silently queued behind an unbounded wait.
   */
  const startFlow = useCallback(
    (entry: PermissionFlowEvent, pending: PendingHighlight): Promise<HighlightWriteOutcome> => {
      if (stateRef.current.step !== 'idle') {
        return Promise.resolve({
          status: 'error',
          reason: 'transient',
          message: FLOW_IN_PROGRESS_MESSAGE,
          failedVerses: pending.verses,
          succeededVerses: [],
        })
      }

      const flowId = flowIdRef.current + 1
      flowIdRef.current = flowId

      const promise = new Promise<HighlightWriteOutcome>((resolve) => {
        resolveRef.current = resolve
      })
      const next = send(entry)
      advance(next, flowId, pending)
      return promise
    },
    [advance, send],
  )

  /**
   * The common case: the permission is cached, so the write goes out immediately.
   * Deliberately **not** routed through the reducer — modelling every ordinary
   * highlight as an exclusive flow step would serialize concurrent taps, which
   * `useHighlights` supports and users do constantly.
   */
  const applyThroughGrant = useCallback(
    async (color: string, verses: number[]): Promise<HighlightWriteOutcome> => {
      // Claimed before the write goes out. `useHighlights.apply` binds the
      // passage at this moment, so anything replayed afterwards has to be
      // measured against the same one rather than against wherever the reader
      // has since got to.
      const claimedScope = highlightsRef.current.scope
      const outcome = await highlightsRef.current.apply(color, verses)
      if (outcome.status !== 'error' || outcome.reason !== 'auth') {
        return outcome
      }
      // The cached grant was stale. Drop it and re-prompt once — unless a flow is
      // already running, in which case that flow is the re-prompt.
      if (outcome.failedVerses.length === 0 || stateRef.current.step !== 'idle') {
        return outcome
      }
      authRef.current?.invalidatePermissions()
      // The reader changed chapters while the write was out. The grant was still
      // worth dropping, but the intent belongs to a passage they have left, so
      // there is nothing left to re-prompt for. No flow exists yet at this
      // point, so the render-time RESET had nothing to abandon.
      if (scopeKey(claimedScope) !== scopeKey(highlightsRef.current.scope)) {
        return outcome
      }
      const pending: PendingHighlight = {
        color,
        verses: outcome.failedVerses,
        scope: claimedScope,
      }
      return startFlow({ type: 'AUTH_RETRY', pending }, pending)
    },
    [startFlow],
  )

  const apply = useCallback(
    async (color: string, verses: number[]): Promise<HighlightWriteOutcome> => {
      if (authRef.current === null) {
        warnMissingAuthConfig()
        return highlightsRef.current.apply(color, verses)
      }

      // Built before the first await, so its `scope` records the passage the
      // user actually tapped rather than wherever the reader ends up by the time
      // a decision gets made.
      const pending: PendingHighlight = { color, verses, scope: highlightsRef.current.scope }

      // Pre-flight, in this order. The token refresh comes FIRST: an expired
      // token makes the write 401, a 401 reads as `auth`, and `auth` reads as
      // "the permission cache is stale" — so without this, an expired token
      // presents to the user as a request to grant a permission they already
      // granted.
      await authRef.current.ensureFreshToken()

      const current = authRef.current
      if (current === null) {
        warnMissingAuthConfig()
        return highlightsRef.current.apply(color, verses)
      }

      // That refresh joins a token round-trip when one is due, which is exactly
      // the window in which a reader has time to move. Nothing was written and
      // the passage is gone, so this settles the way every other abandonment does.
      if (scopeKey(pending.scope) !== scopeKey(highlightsRef.current.scope)) {
        return { status: 'noop' }
      }

      if (current.hasPermission(HIGHLIGHTS_PERMISSION)) {
        return applyThroughGrant(color, verses)
      }

      return startFlow(
        { type: 'TAP', pending, branch: current.isAuthenticated ? 'consent' : 'sign-in' },
        pending,
      )
    },
    [applyThroughGrant, startFlow],
  )

  const confirm = useCallback((): void => {
    const current = stateRef.current
    if (current.step !== 'confirming') {
      return
    }
    const { pending } = current
    const flowId = flowIdRef.current
    advance(send({ type: 'CONFIRM' }), flowId, pending)
  }, [advance, send])

  const decline = useCallback((): void => {
    const current = stateRef.current
    if (current.step !== 'confirming') {
      return
    }
    const { pending } = current
    const flowId = flowIdRef.current
    advance(send({ type: 'DECLINE' }), flowId, pending)
  }, [advance, send])

  return {
    highlights,
    isConfirming: renderedState.step === 'confirming',
    apply,
    confirm,
    decline,
    flowError: renderedState.step === 'idle' ? renderedState.error : null,
  }
}

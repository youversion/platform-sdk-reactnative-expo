import { act, renderHook } from '@testing-library/react-native'
import { useEffect, useState, type ReactNode } from 'react'

import type { AuthPermission, DataExchangeOutcome } from '../../auth'
import { AuthContext, type AuthContextValue } from '../../auth/auth-context'
import {
  useHighlightPermissionFlow,
  type UseHighlightPermissionFlowResult,
} from '../use-highlight-permission-flow'
import type {
  HighlightWriteOutcome,
  UseHighlightsOptions,
  UseHighlightsResult,
} from '../use-highlights'

// ── Boundaries ───────────────────────────────────────────────────────────────
// `useHighlights` is mocked wholesale: this hook composes it and must not change
// it, so the only thing worth asserting is what crosses between them.

const mockWriteApply = jest.fn<Promise<HighlightWriteOutcome>, [string, number[]]>()
const mockRemove = jest.fn<Promise<HighlightWriteOutcome>, [string, number[]]>()
const mockRefresh = jest.fn<Promise<void>, []>()

// Built inside the factory, and every name it closes over is `mock`-prefixed:
// babel-plugin-jest-hoist lifts `jest.mock` above the module body, so an object
// assembled at module scope would capture these before they are initialized.
jest.mock('../use-highlights', () => ({
  useHighlights: jest.fn(
    (options: UseHighlightsOptions): UseHighlightsResult => ({
      highlights: [],
      // Follows the options it was rendered with, exactly as the real hook does.
      // A fixed scope here would let a pending highlight replay into a chapter
      // the reader has left without any test noticing.
      scope: { versionId: options.versionId, book: options.book, chapter: options.chapter },
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      apply: mockWriteApply,
      remove: mockRemove,
    }),
  ),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

const YELLOW = 'fffe00'
const GREEN = '5dff79'
const options: UseHighlightsOptions = { versionId: 111, book: 'JHN', chapter: '3' }

/** Ordered log of the pre-flight, so "before" can be asserted rather than assumed. */
let calls: string[] = []

const mockSignIn = jest.fn<Promise<void>, []>()
const mockRequestPermissions = jest.fn<Promise<DataExchangeOutcome>, [readonly AuthPermission[]]>()
const mockInvalidatePermissions = jest.fn<void, []>()

type AuthState = { signedIn: boolean; permissions: string[]; isLoading?: boolean }

/** `null` models a provider with no `auth` configured at all. */
let currentAuth: AuthState | null = null

const listeners = new Set<() => void>()

/**
 * Move the auth context and re-render the provider, the way `AuthProvider` does
 * when its own state changes. Anything that only mutated the module variable
 * would let a hook holding a stale context object pass.
 */
function setAuth(next: AuthState | null): void {
  currentAuth = next
  for (const listener of listeners) {
    listener()
  }
}

function authValue(state: AuthState): AuthContextValue {
  return {
    isAuthenticated: state.signedIn,
    accessToken: state.signedIn ? 'token-1' : null,
    userInfo: state.signedIn ? { id: 'user-1' } : null,
    error: null,
    signIn: mockSignIn,
    signOut: jest.fn(),
    refreshNow: jest.fn(),
    getAccessToken: jest.fn(async () =>
      state.signedIn
        ? ({ status: 'ok', token: 'token-1', userId: 'user-1' } as const)
        : ({ status: 'unavailable', reason: 'signed-out' } as const),
    ),
    isLoading: state.isLoading ?? false,
    // An app that reaches this flow has asked for `highlights` — the reader
    // never mounts the fetch otherwise (`shouldFetchHighlights`). What the user
    // then granted is `state.permissions` below, which is what this suite
    // varies.
    requestedPermissions: ['highlights'],
    grantedPermissions: state.permissions,
    hasPermission: (permission) => {
      calls.push(`hasPermission:${permission}`)
      return state.permissions.includes(permission)
    },
    invalidatePermissions: mockInvalidatePermissions,
    requestPermissions: mockRequestPermissions,
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  const [, force] = useState(0)
  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  // A fresh context value per render, matching AuthProvider's useMemo when its
  // inputs change. `null` is supplied through the provider rather than by dropping
  // it from the tree: `use(AuthContext)` sees the same `null` either way, and
  // removing the element would remount the subtree — losing the flow under test
  // for reasons that have nothing to do with auth.
  return (
    <AuthContext.Provider value={currentAuth === null ? null : authValue(currentAuth)}>
      {children}
    </AuthContext.Provider>
  )
}

function renderFlow(initialProps: UseHighlightsOptions = options) {
  return renderHook((props: UseHighlightsOptions) => useHighlightPermissionFlow(props), {
    wrapper: Wrapper,
    initialProps,
  })
}

type FlowResult = { current: UseHighlightPermissionFlowResult }

/**
 * Start an apply and hand back its promise **unawaited** — most of these flows
 * are still waiting on the user when this returns, so awaiting here would hang.
 */
async function startApply(
  result: FlowResult,
  color = YELLOW,
  verses = [16],
): Promise<{ promise: Promise<HighlightWriteOutcome> }> {
  let promise: Promise<HighlightWriteOutcome> | undefined
  await act(async () => {
    promise = result.current.apply(color, verses)
  })
  if (promise === undefined) {
    throw new Error('apply() did not return a promise')
  }
  return { promise }
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void }

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const authWriteError = (failedVerses: number[]): HighlightWriteOutcome => ({
  status: 'error',
  reason: 'auth',
  message: 'unauthorized',
  failedVerses,
  succeededVerses: [],
})

const grantedOutcome: DataExchangeOutcome = {
  status: 'granted',
  grantedPermissions: ['highlights'],
}

const signedInWithGrant: AuthState = { signedIn: true, permissions: ['highlights'] }
const signedInNoGrant: AuthState = { signedIn: true, permissions: [] }
const signedOut: AuthState = { signedIn: false, permissions: [] }

beforeEach(() => {
  jest.clearAllMocks()
  mockWriteApply.mockReset()
  mockRequestPermissions.mockReset()
  mockSignIn.mockReset()

  calls = []
  currentAuth = signedInWithGrant

  mockWriteApply.mockImplementation(async (_color, verses) => {
    calls.push('apply')
    return { status: 'ok', verses }
  })
  // Default: the user dismisses the browser. `signIn` resolves on cancel too, so
  // a cancel is indistinguishable from success until auth state is re-read —
  // which is the whole reason the flow re-reads it.
  mockSignIn.mockImplementation(async () => undefined)
  mockRequestPermissions.mockResolvedValue({ status: 'cancel' })
})

// ── The pre-flight ───────────────────────────────────────────────────────────

describe('pre-flight', () => {
  it('does not write or sign in while auth is still loading', async () => {
    currentAuth = { signedIn: false, permissions: [], isLoading: true }

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    expect(mockWriteApply).not.toHaveBeenCalled()
    expect(mockSignIn).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)

    let settled = false
    void promise.then(() => {
      settled = true
    })
    await act(async () => undefined)
    expect(settled).toBe(false)
  })

  it('writes once bootstrap settles with a grant, without opening sign-in', async () => {
    currentAuth = { signedIn: false, permissions: [], isLoading: true }

    const { result } = renderFlow()
    const { promise } = await startApply(result)
    expect(mockWriteApply).not.toHaveBeenCalled()

    await act(async () => {
      setAuth(signedInWithGrant)
    })

    await expect(promise).resolves.toEqual({ status: 'ok', verses: [16] })
    expect(mockWriteApply).toHaveBeenCalledWith(YELLOW, [16])
    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockRequestPermissions).not.toHaveBeenCalled()
  })

  it('starts sign-in once bootstrap settles signed out', async () => {
    currentAuth = { signedIn: false, permissions: [], isLoading: true }

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    await act(async () => {
      setAuth(signedOut)
    })

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockWriteApply).not.toHaveBeenCalled()
    await expect(promise).resolves.toEqual({ status: 'noop' })
  })

  it('writes straight through when the permission is already granted', async () => {
    const { result } = renderFlow()
    const { promise } = await startApply(result)

    await expect(promise).resolves.toEqual({ status: 'ok', verses: [16] })
    expect(mockWriteApply).toHaveBeenCalledWith(YELLOW, [16])
    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.flowError).toBeNull()
  })

  it('reaches the write without awaiting anything first', async () => {
    const { result } = renderFlow()

    let promise: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      promise = result.current.apply(YELLOW, [16])
    })

    // Asserted with no `await` in between. If `apply` awaited anything before
    // branching, the write would not have gone out yet — and since the
    // optimistic paint lives inside it, the user would be looking at unpainted
    // text until that await resolved. The token refresh the write needs runs
    // inside `useHighlights.runWrite` instead, behind the claim (ADR 0016).
    expect(calls).toEqual(['hasPermission:highlights', 'apply'])

    await act(async () => {
      await promise
    })
  })

  it('leaves remove alone — a user with visible highlights already has the grant', () => {
    const { result } = renderFlow()

    expect(result.current.highlights.remove).toBe(mockRemove)
    expect(result.current.highlights.refresh).toBe(mockRefresh)
  })
})

// ── Branch 1: not signed in ──────────────────────────────────────────────────

describe('the not-signed-in branch', () => {
  beforeEach(() => {
    currentAuth = signedOut
  })

  it('signs in, then applies without asking for consent when sign-in granted it', async () => {
    mockSignIn.mockImplementation(async () => {
      setAuth(signedInWithGrant)
    })

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    await expect(promise).resolves.toEqual({ status: 'ok', verses: [16] })
    expect(mockSignIn).toHaveBeenCalledTimes(1)
    // The grant rides on the OAuth redirect, so asking again would ask twice.
    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(mockWriteApply).toHaveBeenCalledWith(YELLOW, [16])
  })

  it('falls through to consent when sign-in did not grant the permission', async () => {
    mockSignIn.mockImplementation(async () => {
      setAuth(signedInNoGrant)
    })
    mockRequestPermissions.mockResolvedValue(grantedOutcome)

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    expect(result.current.isConfirming).toBe(true)
    expect(mockWriteApply).not.toHaveBeenCalled()

    await act(async () => {
      result.current.confirm()
    })

    await expect(promise).resolves.toEqual({ status: 'ok', verses: [16] })
    expect(mockRequestPermissions).toHaveBeenCalledWith(['highlights'])
  })

  it('discards the highlight when sign-in is cancelled, and reports nothing', async () => {
    const { result } = renderFlow()
    const { promise } = await startApply(result)

    await expect(promise).resolves.toEqual({ status: 'noop' })
    expect(mockWriteApply).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.flowError).toBeNull()
  })

  it('discards the highlight when sign-in throws', async () => {
    mockSignIn.mockRejectedValue(new Error('token endpoint exploded'))

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    // The rejection stays on the auth context's `error`; a caller who asked for a
    // highlight is not handed somebody else's throw.
    await expect(promise).resolves.toEqual({ status: 'noop' })
    expect(mockWriteApply).not.toHaveBeenCalled()
  })
})

// ── Branch 2: signed in without the permission ───────────────────────────────

describe('the signed-in-without-permission branch', () => {
  beforeEach(() => {
    currentAuth = signedInNoGrant
  })

  it('asks for consent, then grants and applies', async () => {
    mockRequestPermissions.mockResolvedValue(grantedOutcome)

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    expect(result.current.isConfirming).toBe(true)
    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(mockWriteApply).not.toHaveBeenCalled()

    await act(async () => {
      result.current.confirm()
    })

    await expect(promise).resolves.toEqual({ status: 'ok', verses: [16] })
    expect(mockRequestPermissions).toHaveBeenCalledWith(['highlights'])
    expect(mockWriteApply).toHaveBeenCalledWith(YELLOW, [16])
    expect(result.current.isConfirming).toBe(false)
  })

  it('never writes when the user declines', async () => {
    const { result } = renderFlow()
    const { promise } = await startApply(result)

    await act(async () => {
      result.current.decline()
    })

    await expect(promise).resolves.toEqual({ status: 'noop' })
    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(mockWriteApply).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
    // A decline is a choice, not a failure — nothing to toast.
    expect(result.current.flowError).toBeNull()
  })

  it('discards the highlight when the consent page is cancelled', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'cancel' })

    const { result } = renderFlow()
    const { promise } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })

    await expect(promise).resolves.toEqual({ status: 'noop' })
    expect(mockWriteApply).not.toHaveBeenCalled()
    expect(result.current.flowError).toBeNull()
  })

  it('surfaces a failed grant and does not write', async () => {
    mockRequestPermissions.mockResolvedValue({
      status: 'failure',
      reason: 'not-permitted',
      message: 'this app key is not enabled for data exchange',
    })

    const { result } = renderFlow()
    const { promise } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })

    // `not-permitted` is a configuration fact, so it reports as `invalid` rather
    // than inviting a retry.
    await expect(promise).resolves.toEqual({
      status: 'error',
      reason: 'invalid',
      message: 'this app key is not enabled for data exchange',
      failedVerses: [16],
      succeededVerses: [],
    })
    expect(result.current.flowError).toEqual({
      reason: 'not-permitted',
      message: 'this app key is not enabled for data exchange',
    })
    expect(mockWriteApply).not.toHaveBeenCalled()
  })

  it('does not write when the grant came back without the highlights permission', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted', grantedPermissions: ['bibles'] })

    const { result } = renderFlow()
    const { promise } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })

    await expect(promise).resolves.toMatchObject({ status: 'error', reason: 'invalid' })
    expect(mockWriteApply).not.toHaveBeenCalled()
  })

  it('ignores confirm and decline when no prompt is open', async () => {
    const { result } = renderFlow()

    await act(async () => {
      result.current.confirm()
      result.current.decline()
    })

    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
  })

  it('refuses an overlapping tap rather than opening a second browser session', async () => {
    const { result } = renderFlow()
    const first = await startApply(result, YELLOW, [16])
    expect(result.current.isConfirming).toBe(true)

    const second = await startApply(result, GREEN, [17])

    await expect(second.promise).resolves.toEqual({
      status: 'error',
      reason: 'transient',
      message: expect.stringContaining('already in progress'),
      failedVerses: [17],
      succeededVerses: [],
    })
    // The first tap is untouched — it is still the highlight the user is waiting on.
    expect(result.current.isConfirming).toBe(true)

    await act(async () => {
      result.current.decline()
    })
    await first.promise
  })
})

// ── The corrective path ──────────────────────────────────────────────────────

describe('a stale cached grant', () => {
  it('invalidates the grant and re-prompts once, then applies', async () => {
    mockWriteApply
      .mockResolvedValueOnce(authWriteError([16]))
      .mockResolvedValueOnce({ status: 'ok', verses: [16] })
    mockRequestPermissions.mockResolvedValue(grantedOutcome)

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    // The cache said yes and the server said no, so the cache is wrong — keeping
    // it would make the next pre-flight read the same wrong answer.
    expect(mockInvalidatePermissions).toHaveBeenCalledTimes(1)
    expect(result.current.isConfirming).toBe(true)

    await act(async () => {
      result.current.confirm()
    })

    await expect(promise).resolves.toEqual({ status: 'ok', verses: [16] })
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1)
    expect(mockWriteApply).toHaveBeenCalledTimes(2)
  })

  it('replays only the verses that failed', async () => {
    mockWriteApply
      .mockResolvedValueOnce({
        status: 'error',
        reason: 'auth',
        message: 'unauthorized',
        failedVerses: [17],
        succeededVerses: [16],
      })
      .mockResolvedValueOnce({ status: 'ok', verses: [17] })
    mockRequestPermissions.mockResolvedValue(grantedOutcome)

    const { result } = renderFlow()
    const { promise } = await startApply(result, YELLOW, [16, 17])
    await act(async () => {
      result.current.confirm()
    })
    await promise

    expect(mockWriteApply).toHaveBeenNthCalledWith(1, YELLOW, [16, 17])
    expect(mockWriteApply).toHaveBeenNthCalledWith(2, YELLOW, [17])
  })

  it('gives up after one re-prompt instead of looping the consent page', async () => {
    mockWriteApply.mockResolvedValue(authWriteError([16]))
    mockRequestPermissions.mockResolvedValue(grantedOutcome)

    const { result } = renderFlow()
    const { promise } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })

    await expect(promise).resolves.toMatchObject({ status: 'error', reason: 'auth' })
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1)
    expect(mockWriteApply).toHaveBeenCalledTimes(2)
    expect(mockInvalidatePermissions).toHaveBeenCalledTimes(1)
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.flowError).toEqual({ reason: 'auth', message: 'unauthorized' })
  })

  it('re-prompts once when the write the CONSENT branch resumed is itself refused', async () => {
    // The grant landed and the server still said no — the same corrective edge as
    // the fast path, but reached from a resumed pending highlight.
    currentAuth = signedInNoGrant
    mockRequestPermissions.mockResolvedValue(grantedOutcome)
    mockWriteApply
      .mockResolvedValueOnce(authWriteError([16]))
      .mockResolvedValueOnce({ status: 'ok', verses: [16] })

    const { result } = renderFlow()
    const { promise } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })

    expect(mockInvalidatePermissions).toHaveBeenCalledTimes(1)
    expect(result.current.isConfirming).toBe(true)

    await act(async () => {
      result.current.confirm()
    })

    await expect(promise).resolves.toEqual({ status: 'ok', verses: [16] })
    expect(mockRequestPermissions).toHaveBeenCalledTimes(2)
    expect(mockWriteApply).toHaveBeenCalledTimes(2)
  })

  it('reports a non-auth write failure as itself, with no prompt', async () => {
    mockWriteApply.mockResolvedValue({
      status: 'error',
      reason: 'transient',
      message: 'boom',
      failedVerses: [16],
      succeededVerses: [],
    })

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    await expect(promise).resolves.toMatchObject({ status: 'error', reason: 'transient' })
    expect(mockInvalidatePermissions).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.flowError).toBeNull()
  })

  it('does not re-prompt for an auth refusal that names no verses', async () => {
    mockWriteApply.mockResolvedValue(authWriteError([]))

    const { result } = renderFlow()
    const { promise } = await startApply(result)

    await expect(promise).resolves.toMatchObject({ status: 'error', reason: 'auth' })
    expect(mockInvalidatePermissions).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
  })
})

// ── Scope changes and unmount ────────────────────────────────────────────────

describe('when the reader moves on', () => {
  it('discards the flow, and a late grant cannot resurrect the highlight', async () => {
    currentAuth = signedInNoGrant
    const grant = deferred<DataExchangeOutcome>()
    mockRequestPermissions.mockReturnValue(grant.promise)

    const { result, rerender } = renderFlow()
    const { promise } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1)

    await act(async () => {
      rerender({ ...options, chapter: '4' })
    })

    expect(result.current.isConfirming).toBe(false)
    await expect(promise).resolves.toEqual({ status: 'noop' })

    // The consent page returns to a flow that no longer exists.
    await act(async () => {
      grant.resolve(grantedOutcome)
    })

    expect(mockWriteApply).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
  })

  it('clears a terminal error so it cannot outlive the chapter it happened in', async () => {
    currentAuth = signedInNoGrant
    mockRequestPermissions.mockResolvedValue({
      status: 'failure',
      reason: 'transient',
      message: 'boom',
    })

    const { result, rerender } = renderFlow()
    const { promise } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })
    await promise
    expect(result.current.flowError).not.toBeNull()

    await act(async () => {
      rerender({ ...options, chapter: '4' })
    })

    expect(result.current.flowError).toBeNull()
  })

  it('drops a sign-in that returns after the reader moved on', async () => {
    currentAuth = signedOut
    const browser = deferred<void>()
    mockSignIn.mockImplementation(() => browser.promise)

    const { result, rerender } = renderFlow()
    const { promise } = await startApply(result)
    expect(mockSignIn).toHaveBeenCalledTimes(1)

    await act(async () => {
      rerender({ ...options, chapter: '4' })
    })
    await expect(promise).resolves.toEqual({ status: 'noop' })

    // Sign-in succeeds *after* the flow was discarded. The highlight belonged to a
    // chapter the user has left, so it must not be applied to the one they are on.
    await act(async () => {
      setAuth(signedInWithGrant)
      browser.resolve()
    })

    expect(mockWriteApply).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
  })

  it('drops a write that settles after the reader moved on', async () => {
    currentAuth = signedInNoGrant
    mockRequestPermissions.mockResolvedValue(grantedOutcome)
    const write = deferred<HighlightWriteOutcome>()
    mockWriteApply.mockReturnValue(write.promise)

    const { result, rerender } = renderFlow()
    const { promise } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })
    expect(mockWriteApply).toHaveBeenCalledTimes(1)

    await act(async () => {
      rerender({ ...options, chapter: '4' })
    })
    await expect(promise).resolves.toEqual({ status: 'noop' })

    // The write itself is left to land — `useHighlights` owns that — but it can no
    // longer drive a flow that no longer exists.
    await act(async () => {
      write.resolve(authWriteError([16]))
    })

    expect(mockInvalidatePermissions).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
  })

  it('does not re-prompt for a write that was refused after the reader moved on', async () => {
    // The permission is cached, so this takes the straight-through path and no
    // flow exists yet while the write is out. Nothing has a caller to abandon,
    // so the render-time RESET cannot help here — only the claimed scope can.
    currentAuth = signedInWithGrant
    mockRequestPermissions.mockResolvedValue(grantedOutcome)
    const write = deferred<HighlightWriteOutcome>()
    mockWriteApply.mockReturnValue(write.promise)

    const { result, rerender } = renderFlow()
    const { promise } = await startApply(result, YELLOW, [16, 17, 18])

    await act(async () => {
      rerender({ ...options, chapter: '4' })
    })
    await act(async () => {
      write.resolve(authWriteError([16, 17, 18]))
    })

    // The grant is demonstrably wrong either way, so dropping it is still right.
    expect(mockInvalidatePermissions).toHaveBeenCalledTimes(1)

    // But verses 16-18 belong to JHN.3. Re-prompting here would end in a write
    // through JHN.4's hook, painting text the user never selected.
    expect(result.current.isConfirming).toBe(false)
    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(mockWriteApply).toHaveBeenCalledTimes(1)
    await expect(promise).resolves.toEqual(authWriteError([16, 17, 18]))
  })

  // There used to be a third window here: the reader moving while the
  // pre-flight refresh was out. That refresh moved into
  // `useHighlights.runWrite` (ADR 0016), so `apply` no longer awaits anything
  // before it branches and the window it guarded cannot open. The test above,
  // "reaches the write without awaiting anything first", is what keeps it shut.

  it('settles a waiting caller on unmount instead of leaving the promise pending', async () => {
    currentAuth = signedInNoGrant

    const { result, unmount } = renderFlow()
    const { promise } = await startApply(result)
    expect(result.current.isConfirming).toBe(true)

    await act(async () => {
      unmount()
    })

    await expect(promise).resolves.toEqual({ status: 'noop' })
  })
})

describe('when the provider loses its auth config mid-flow', () => {
  it('reports not-signed-in rather than trying to mint a grant', async () => {
    currentAuth = signedInNoGrant

    const { result } = renderFlow()
    const { promise } = await startApply(result)
    expect(result.current.isConfirming).toBe(true)

    await act(async () => {
      setAuth(null)
    })
    await act(async () => {
      result.current.confirm()
    })

    await expect(promise).resolves.toMatchObject({
      status: 'error',
      reason: 'not-signed-in',
      failedVerses: [16],
    })
    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(false)
  })
})

// ── Misconfiguration ─────────────────────────────────────────────────────────
// Must stay the only block that runs without `auth`: the warning fires once per
// module instance, by design.

describe('with no auth configured', () => {
  it('warns once and behaves exactly as signed out', async () => {
    currentAuth = null
    const notSignedIn: HighlightWriteOutcome = {
      status: 'error',
      reason: 'not-signed-in',
      message: 'Not signed in',
      failedVerses: [16],
      succeededVerses: [],
    }
    mockWriteApply.mockResolvedValue(notSignedIn)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const { result } = renderFlow()
    const first = await startApply(result)
    await expect(first.promise).resolves.toEqual(notSignedIn)
    const second = await startApply(result)
    await second.promise

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('needs `auth` configured')
    // Passed straight through both times — no prompt, no flow, no sign-in.
    expect(mockWriteApply).toHaveBeenCalledTimes(2)
    expect(result.current.isConfirming).toBe(false)

    warn.mockRestore()
  })
})

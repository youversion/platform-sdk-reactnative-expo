import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { z } from 'zod'
import { toMessage } from '../error-message'
import { clearHighlightsCache } from '../highlights'
import { getOrSetInstallationId } from '../installation-id'
import { mmkvStorage } from '../storage/mmkv-storage'
import { AuthContext, type AuthContextValue } from './auth-context'
import { MMKV_AUTH_KEYS, REFRESH_LEEWAY_SECONDS } from './constants'
import { requestDataExchange, type AuthIdentity, type DataExchangeOutcome } from './data-exchange'
import { createDataExchangeApi } from './data-exchange-api'
import {
  clearGrantedPermissions,
  loadCachedGrantedPermissions,
  mergeGrantedPermissions,
  saveGrantedPermissions,
} from './granted-permissions-cache'
import { refreshTokens, TokenEndpointError } from './http'
import { sanitizeAvatarUrl } from './id-token'
import { signInWithPKCE } from './pkce-flow'
import { loadTokens, saveTokens, type StoredTokens } from './token-storage'
import type { AuthConfig, AuthPermission, YVUserInfo } from './types'

// Stable empty reference, so an unconfigured `permissions` does not give the
// context value a new identity on every render.
const NO_PERMISSIONS: readonly AuthPermission[] = []

type AuthProviderProps = {
  config: AuthConfig
  appKey: string
  apiHost: string
  children: ReactNode
}

export default function AuthProvider({ config, appKey, apiHost, children }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<YVUserInfo | null>(() => loadCachedUserInfo())
  // Seeded synchronously so hasPermission answers correctly on the first render
  // after a cold start — the same pattern (and load-bearing coupling) as the
  // userInfo initializer above, which useHighlights also depends on.
  const [grantedPermissions, setGrantedPermissions] = useState<readonly string[] | null>(() =>
    loadCachedGrantedPermissions(userInfo?.id ?? null),
  )
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const expiryRef = useRef<Date | null>(null)
  const refreshTokenRef = useRef<string | null>(null)
  // The single in-flight refresh, held as a promise rather than a boolean so a
  // second caller can *join* it. A caller that awaits `refreshToken` needs a
  // usable token when it resolves; a boolean flag can only tell it to give up
  // and carry on with the expired one it was trying to replace.
  const refreshPromiseRef = useRef<Promise<void> | null>(null)
  // The access token as a ref, alongside the state, for the one read that has to
  // see past the render closure: data exchange refreshes before minting, and the
  // token it must send is the one that refresh just wrote, not the one this
  // render captured.
  const accessTokenRef = useRef<string | null>(null)

  // Latest identity, for a read that has to outlive a render: the data-exchange
  // initiator guard needs who is signed in *now*, once the browser comes back,
  // not who was captured in the closure when the flow started.
  //
  // The session id counts identity transitions — sign-in and sign-out, never a
  // token refresh — so the guard can tell "signed out" from "signed in without
  // an id", which a null `userInfo.id` alone cannot. Both are written together
  // by `setIdentity` so they can never disagree; an effect would leave a window
  // where the session id has moved and the id has not.
  const userInfoRef = useRef<YVUserInfo | null>(userInfo)
  const sessionIdRef = useRef<number>(0)

  const setIdentity = useCallback((user: YVUserInfo | null) => {
    userInfoRef.current = user
    sessionIdRef.current += 1
    setUserInfo(user)

    if (user) {
      mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(user))
    }
  }, [])

  const getCurrentIdentity = useCallback(
    (): AuthIdentity => ({
      sessionId: sessionIdRef.current,
      userId: userInfoRef.current?.id ?? null,
    }),
    [],
  )

  // The single in-flight data-exchange request, keyed by what it asked for so
  // only an identical request is allowed to share its outcome.
  const inFlightRequestRef = useRef<{
    key: string
    promise: Promise<DataExchangeOutcome>
  } | null>(null)

  const setAuthState = useCallback(
    async (tokens: StoredTokens, user?: YVUserInfo) => {
      await saveTokens(tokens)
      expiryRef.current = tokens.expiryDate
      refreshTokenRef.current = tokens.refreshToken
      accessTokenRef.current = tokens.accessToken
      setAccessToken(tokens.accessToken)

      if (user) {
        // Identity, not just tokens — start a new session. A call without `user`
        // is a token refresh for the same person and must leave the session id
        // alone, or a refresh landing mid-flow would fail the initiator guard.
        setIdentity(user)
      }
    },
    [setIdentity],
  )

  // Always both halves: the cached entry and the in-memory state hasPermission
  // actually reads.
  const invalidatePermissions = useCallback(() => {
    clearGrantedPermissions()
    setGrantedPermissions(null)
  }, [])

  const clearAuthState = useCallback(async () => {
    mmkvStorage.remove(MMKV_AUTH_KEYS.cachedUserInfo)
    invalidatePermissions()
    clearHighlightsCache()
    expiryRef.current = null
    refreshTokenRef.current = null
    accessTokenRef.current = null
    setAccessToken(null)
    setIdentity(null)
    setError(null)
    await saveTokens({ accessToken: null, refreshToken: null, expiryDate: null })
  }, [invalidatePermissions, setIdentity])

  const refreshToken = useCallback(
    async (options?: { force?: boolean }): Promise<void> => {
      const currentRefreshToken = refreshTokenRef.current
      if (!currentRefreshToken) {
        return
      }
      const expiresAt = expiryRef.current?.getTime() ?? 0

      if (!options?.force && expiresAt > Date.now() + REFRESH_LEEWAY_SECONDS * 1000) {
        return
      }

      // Join an in-flight refresh rather than stepping over it. The trigger is
      // ordinary: the app foregrounds, the `AppState` listener starts a refresh,
      // and the user taps a moment later. Returning early there would resolve a
      // pre-flight on the very token this refresh exists to replace, and the
      // write that followed would 401.
      //
      // A `force` caller joins too. It asked for a token minted now, and the run
      // it joins was minted now.
      const inFlight = refreshPromiseRef.current
      if (inFlight !== null) {
        return inFlight
      }

      const run = (async () => {
        try {
          const response = await refreshTokens({
            apiHost,
            appKey,
            refreshToken: currentRefreshToken,
          })
          await setAuthState({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            expiryDate: new Date(Date.now() + Number(response.expires_in) * 1000),
          })
        } catch (e) {
          if (e instanceof TokenEndpointError && e.isRevoked) {
            await clearAuthState()
          }
          setError(e instanceof Error ? e : new Error(String(e)))
        }
      })()

      // Published in the same synchronous block that started `run`, so nothing
      // can arrive between the two and open a second refresh. Only the caller
      // that started the run clears it; joiners return the promise untouched.
      refreshPromiseRef.current = run
      try {
        await run
      } finally {
        refreshPromiseRef.current = null
      }
    },
    [apiHost, appKey, setAuthState, clearAuthState],
  )

  // The bootstrap effect below runs once on mount but calls setAuthState /
  // refreshToken / clearAuthState. Listing those as deps would re-run bootstrap
  // (re-loading tokens from storage) whenever apiHost/appKey change, since that
  // changes refreshToken's identity. Keep the latest callbacks in a ref so the
  // mount-only effect can call them without capturing reactive values.
  const authActionsRef = useRef({ setAuthState, refreshToken, clearAuthState })
  useEffect(() => {
    authActionsRef.current = { setAuthState, refreshToken, clearAuthState }
  }, [setAuthState, refreshToken, clearAuthState])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const stored = await loadTokens()
        if (cancelled) {
          return
        }

        const { setAuthState, refreshToken, clearAuthState } = authActionsRef.current
        if (stored.refreshToken) {
          await setAuthState(stored)
          await refreshToken()
        } else {
          await clearAuthState()
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active') {
        refreshToken()
      }
    }
    const sub = AppState.addEventListener('change', handler)
    return () => sub.remove()
  }, [refreshToken])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      const result = await signInWithPKCE({
        apiHost,
        appKey,
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        permissions: config.permissions,
      })

      if (result.kind === 'cancel') {
        return
      }
      await setAuthState(
        {
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          expiryDate: new Date(Date.now() + Number(result.tokens.expires_in) * 1000),
        },
        result.userInfo,
      )

      const nextUserId = result.userInfo.id ?? null
      if (result.grantedPermissions != null) {
        saveGrantedPermissions(nextUserId, result.grantedPermissions)
        setGrantedPermissions(result.grantedPermissions)
      } else {
        // The redirect said nothing about permissions (scopes-only sign-in).
        // Re-read the cache scoped to whoever just signed in: the same user
        // keeps a grant from an earlier sign-in, a different user reads null —
        // no explicit user-switch handling needed.
        //
        // This branch is only safe because a *denial* is not silent: the
        // gateway spec says a denial sends `granted_permissions=` (empty), so
        // it lands in the `if` above as `[]`, not here. See
        // {@link readGrantedPermissions}. If the server ever omitted the key on
        // denial instead, a denial would reach this branch and restore the
        // user's previous grant.
        setGrantedPermissions(loadCachedGrantedPermissions(nextUserId))
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      throw err
    }
  }, [apiHost, appKey, config.redirectUri, config.scopes, config.permissions, setAuthState])

  const signOut = useCallback(async () => {
    await clearAuthState()
  }, [clearAuthState])

  const refreshNow = useCallback(() => refreshToken({ force: true }), [refreshToken])

  const requestedPermissions = config.permissions ?? NO_PERMISSIONS

  // The leeway-gated refresh, made public under a name that says what a caller
  // wants from it. A pre-flight before a permission-sensitive write needs "make
  // sure the token is usable" without paying for a token round-trip on every
  // tap, which is exactly the non-forced path — and, since the refresh is
  // single-flight by promise, awaiting it does mean the token is usable.
  const ensureFreshToken = useCallback(() => refreshToken(), [refreshToken])

  const hasPermission = useCallback(
    (permission: AuthPermission) => grantedPermissions?.includes(permission) ?? false,
    [grantedPermissions],
  )

  const requestPermissions = useCallback(
    (permissions: readonly AuthPermission[]): Promise<DataExchangeOutcome> => {
      // No token means no mint attempt: the endpoint would 401, and that 401
      // would read as "this app may not run data exchange" rather than the
      // truth, which is that nobody is signed in.
      if (accessToken === null) {
        return Promise.resolve({
          status: 'failure',
          reason: 'not-signed-in',
          message: 'Not signed in — requesting a permission requires an authenticated user.',
        })
      }

      // One flow at a time: a second concurrent request must not mint another
      // token or open another auth session (on Android the second
      // `openAuthSessionAsync` rejects outright). What happens to it depends on
      // whether it is asking for the same thing.
      //
      // Same permissions — a double-tap — shares the in-flight promise, because
      // both callers genuinely want that one answer. A *different* set may not:
      // the open consent page never mentions its permissions, so handing it that
      // outcome would report `granted` for something the user was never shown,
      // with nothing telling the caller to try again.
      //
      // It gets `in-progress`, not `transient`. `transient` is the reason a
      // caller retries on immediately, and an immediate retry lands right back
      // here while the consent page is still open — a spin, not a recovery.
      // `in-progress` says the one thing that is actually actionable: wait for
      // the flow that is already running.
      const key = permissionKey(permissions)
      const inFlight = inFlightRequestRef.current
      if (inFlight !== null) {
        return inFlight.key === key
          ? inFlight.promise
          : Promise.resolve({
              status: 'failure',
              reason: 'in-progress',
              message:
                'Another permission request is already in progress; retry once it has finished.',
            })
      }

      // Snapshot the initiator here, in the same synchronous block that read
      // `accessToken`, not later inside `run`. The two must describe one moment:
      // the token comes from this render, so reading the identity after an await
      // would let a sign-out landing in between pair the previous session's
      // token with the replacement identity — the guard would then compare the
      // new identity against itself, pass, and file the grant under whoever is
      // signed in now (or under the shared null identity).
      const initiator = getCurrentIdentity()

      const run = async (): Promise<DataExchangeOutcome> => {
        // Mint with a token the server will still take. Refresh is otherwise
        // driven only by bootstrap and the AppState `active` handler, so a long
        // foreground session can carry an expired token straight into the mint.
        // That 401s, and `data-exchange-api.ts` reads every mint 401 as
        // `not-permitted` — which the docs tell consumers is an app-key setting,
        // not a user problem. The user would be dead-ended by a stale token and
        // told to check the console. Refreshing first keeps the 401 honest.
        //
        // This is the no-op path in the common case: `refreshToken` returns
        // immediately unless the expiry is inside the leeway window.
        await refreshToken()

        // Prefer the ref over the closure: refresh may have just replaced the
        // token. Fall back to the closure token when the ref is null, which
        // means the session was cleared while this flow was starting — a
        // sign-out, or a refresh that found the token revoked.
        //
        // Falling back rather than bailing keeps the initiator guard's story
        // intact: the mint uses the token this render captured, the guard
        // re-reads identity after the browser returns, and a session that moved
        // mid-flow reports `user-changed`. Bailing here would report
        // `not-signed-in` instead, which is a different contract than the one
        // documented, and one subtask 3 has not been written against.
        const freshAccessToken = accessTokenRef.current ?? accessToken

        // Built per call rather than memoized: the installation id is async, and
        // this runs at most once per user gesture. It reads native state and can
        // reject, which would escape as a throw from a flow documented to
        // resolve — so it is guarded like the browser call inside the flow.
        let installationId: string
        try {
          installationId = await getOrSetInstallationId()
        } catch (caught) {
          return {
            status: 'failure',
            reason: 'transient',
            message: toMessage(caught),
          }
        }

        const outcome = await requestDataExchange({
          api: createDataExchangeApi({ appKey, apiHost, installationId }),
          appKey,
          apiHost,
          accessToken: freshAccessToken,
          redirectUri: config.redirectUri,
          initiator,
          permissions,
          getCurrentIdentity,
        })

        // The flow already merged the grant into MMKV; mirror that merge into
        // state with the same helper so hasPermission flips without a remount.
        if (outcome.status === 'granted' && outcome.grantedPermissions.length > 0) {
          const granted = outcome.grantedPermissions
          setGrantedPermissions((prev) => mergeGrantedPermissions(prev ?? [], granted))
        }

        return outcome
      }

      const pending = run().finally(() => {
        inFlightRequestRef.current = null
      })
      inFlightRequestRef.current = { key, promise: pending }
      return pending
    },
    [accessToken, apiHost, appKey, config.redirectUri, getCurrentIdentity, refreshToken],
  )

  const value: AuthContextValue = useMemo(
    () => ({
      isAuthenticated: accessToken !== null,
      accessToken,
      userInfo,
      error,
      signIn,
      signOut,
      refreshNow,
      ensureFreshToken,
      isLoading,
      requestedPermissions,
      grantedPermissions,
      hasPermission,
      invalidatePermissions,
      requestPermissions,
    }),
    [
      accessToken,
      userInfo,
      error,
      signIn,
      signOut,
      refreshNow,
      ensureFreshToken,
      isLoading,
      requestedPermissions,
      grantedPermissions,
      hasPermission,
      invalidatePermissions,
      requestPermissions,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Identity of a permission request, for deciding whether a concurrent caller is
 * asking for the same thing. Order- and duplicate-insensitive: `['a','b']` and
 * `['b','a','b']` request the same consent, so they may share one flow.
 */
function permissionKey(permissions: readonly AuthPermission[]): string {
  return [...new Set(permissions)].sort().join(',')
}

// Validate untrusted cached JSON instead of blindly casting it to YVUserInfo.
// The cache can predate the current schema, be hand-tampered, or be corrupt, so
// each identity field falls back to undefined if it isn't a string rather than
// trusting `as` — a corrupt `id` won't discard a valid `email`. avatarUrl is
// left unknown here and run through sanitizeAvatarUrl below: it not only enforces
// the type but also drops placeholders (e.g. "https://none/") persisted by a
// build predating sanitizeAvatarUrl, since deriveUserInfo only runs at sign-in.
const cachedUserInfoSchema = z.object({
  id: z.string().optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  email: z.string().optional().catch(undefined),
  avatarUrl: z.unknown().optional(),
})

function loadCachedUserInfo(): YVUserInfo | null {
  try {
    const userJson = mmkvStorage.getString(MMKV_AUTH_KEYS.cachedUserInfo)
    if (!userJson) {
      return null
    }
    const parsed = cachedUserInfoSchema.safeParse(JSON.parse(userJson))
    if (!parsed.success) {
      return null
    }
    const { avatarUrl, ...identity } = parsed.data
    return { ...identity, avatarUrl: sanitizeAvatarUrl(avatarUrl) }
  } catch {
    return null
  }
}

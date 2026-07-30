import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { z } from 'zod'
import { clearHighlightsCache } from '../highlights'
import { getOrSetInstallationId } from '../installation-id'
import { mmkvStorage } from '../storage/mmkv-storage'
import { AuthContext, type AuthContextValue } from './auth-context'
import { MMKV_AUTH_KEYS, REFRESH_LEEWAY_SECONDS } from './constants'
import {
  requestDataExchange,
  type AuthIdentity,
  type DataExchangeOutcome,
} from './data-exchange'
import { createDataExchangeApi } from './data-exchange-api'
import {
  clearGrantedPermissions,
  loadCachedGrantedPermissions,
  mergeGrantedPermissions,
  saveGrantedPermissions,
} from './granted-permissions'
import { refreshTokens, TokenEndpointError } from './http'
import { sanitizeAvatarUrl } from './id-token'
import { signInWithPKCE } from './pkce-flow'
import { loadTokens, saveTokens, type StoredTokens } from './token-storage'
import type { AuthConfig, AuthPermission, YVUserInfo } from './types'

type AuthProviderProps = {
  config: AuthConfig
  appKey: string
  apiHost: string
  children: ReactNode
}

export default function AuthProvider({ config, appKey, apiHost, children }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<YVUserInfo | null>(() => loadCachedUserInfo())
  const [grantedPermissions, setGrantedPermissions] = useState<string[] | null>(() =>
    loadCachedGrantedPermissions(userInfo?.id ?? null),
  )
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const expiryRef = useRef<Date | null>(null)
  const refreshTokenRef = useRef<string | null>(null)
  const isRefreshingRef = useRef<boolean>(false)

  // Latest identity, for a read that has to outlive a render: the data-exchange
  // initiator guard needs who is signed in *now*, once the browser comes back,
  // not who was captured in the closure when the flow started.
  //
  // The epoch counts identity transitions — sign-in and sign-out, never a token
  // refresh — so the guard can tell "signed out" from "signed in without an id",
  // which a null `userInfo.id` alone cannot. Both are written together by
  // `setIdentity` so they can never disagree; an effect would leave a window
  // where the epoch has moved and the id has not.
  const userInfoRef = useRef<YVUserInfo | null>(userInfo)
  const authEpochRef = useRef<number>(0)

  const setIdentity = useCallback((user: YVUserInfo | null) => {
    userInfoRef.current = user
    authEpochRef.current += 1
    setUserInfo(user)

    if (user) {
      mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(user))
    }
  }, [])

  const getCurrentIdentity = useCallback(
    (): AuthIdentity => ({
      epoch: authEpochRef.current,
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

  const setAuthState = useCallback(async (tokens: StoredTokens, user?: YVUserInfo) => {
    await saveTokens(tokens)
    expiryRef.current = tokens.expiryDate
    refreshTokenRef.current = tokens.refreshToken
    setAccessToken(tokens.accessToken)

    if (user) {
      // Identity, not just tokens — bump the epoch. A call without `user` is a
      // token refresh for the same person and must leave the epoch alone, or a
      // refresh landing mid-flow would fail the initiator guard.
      setIdentity(user)
    }
  }, [setIdentity])

  const clearAuthState = useCallback(async () => {
    mmkvStorage.remove(MMKV_AUTH_KEYS.cachedUserInfo)
    clearGrantedPermissions()
    clearHighlightsCache()
    expiryRef.current = null
    refreshTokenRef.current = null
    setAccessToken(null)
    setIdentity(null)
    setGrantedPermissions(null)
    setError(null)
    await saveTokens({ accessToken: null, refreshToken: null, expiryDate: null })
  }, [setIdentity])

  const refreshToken = useCallback(
    async (options?: { force?: boolean }) => {
      if (!refreshTokenRef.current) {
        return
      }
      const expiresAt = expiryRef.current?.getTime() ?? 0

      if (!options?.force && expiresAt > Date.now() + REFRESH_LEEWAY_SECONDS * 1000) {
        return
      }

      if (isRefreshingRef.current) {
        return
      }
      isRefreshingRef.current = true

      try {
        const response = await refreshTokens({
          apiHost,
          appKey,
          refreshToken: refreshTokenRef.current,
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
      } finally {
        isRefreshingRef.current = false
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
    const previousUserId = userInfo?.id ?? null
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

      // The grant belongs to the session, so it lands only once the session has
      // committed: setAuthState awaits the keychain write, and if that rejects
      // no grant is left describing a sign-in that never took hold. The reverse
      // cannot happen either — the cache writes below never throw, so they can
      // neither reject a sign-in that did commit nor skip the state update.
      const nextUserId = result.userInfo.id ?? null
      if (result.grantedPermissions !== null) {
        saveGrantedPermissions(nextUserId, result.grantedPermissions)
        setGrantedPermissions(result.grantedPermissions)
      } else if (nextUserId !== previousUserId) {
        // A `null` grant means the redirect said nothing about permissions. For
        // the same user that is "unknown" and must not wipe a real grant from an
        // earlier sign-in (this path skips clearAuthState); for a different user
        // it would hand the previous account's permissions to this one.
        clearGrantedPermissions()
        setGrantedPermissions(null)
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      throw err
    }
  }, [
    apiHost,
    appKey,
    config.redirectUri,
    config.scopes,
    config.permissions,
    setAuthState,
    userInfo?.id,
  ])

  const signOut = useCallback(async () => {
    await clearAuthState()
  }, [clearAuthState])

  const refreshNow = useCallback(() => refreshToken({ force: true }), [refreshToken])

  // The leeway-gated refresh, made public under a name that says what a caller
  // wants from it. No new behavior: a pre-flight before a permission-sensitive
  // write needs "make sure the token is usable" without paying for a token
  // round-trip on every tap, which is exactly the non-forced path.
  const ensureFreshToken = useCallback(() => refreshToken(), [refreshToken])

  const hasPermission = useCallback(
    (permission: AuthPermission) => grantedPermissions?.includes(permission) ?? false,
    [grantedPermissions],
  )

  const invalidatePermissions = useCallback(() => {
    clearGrantedPermissions()
    setGrantedPermissions(null)
  }, [])

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
      // with nothing telling the caller to try again. It gets a transient
      // failure instead, which is the truth — a retry once this flow finishes
      // will work.
      const key = permissionKey(permissions)
      const inFlight = inFlightRequestRef.current
      if (inFlight !== null) {
        return inFlight.key === key
          ? inFlight.promise
          : Promise.resolve({
              status: 'failure',
              reason: 'transient',
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
            message: caught instanceof Error ? caught.message : String(caught),
          }
        }

        const outcome = await requestDataExchange({
          api: createDataExchangeApi({ appKey, apiHost, installationId }),
          appKey,
          apiHost,
          accessToken,
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
    [accessToken, apiHost, appKey, getCurrentIdentity],
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

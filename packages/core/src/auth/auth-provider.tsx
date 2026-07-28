import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { z } from 'zod'
import { clearHighlightsCache } from '../highlights'
import { mmkvStorage } from '../storage/mmkv-storage'
import { AuthContext, type AuthContextValue } from './auth-context'
import { MMKV_AUTH_KEYS, REFRESH_LEEWAY_SECONDS } from './constants'
import { requestPermissionViaDataExchange, type RequestPermissionResult } from './data-exchange'
import {
  addGrantedPermissions,
  clearGrantedPermissions,
  getGrantedPermissions,
  saveGrantedPermissions,
  subscribeGrantedPermissions,
} from './granted-permissions'
import { refreshTokens, TokenEndpointError } from './http'
import { sanitizeAvatarUrl } from './id-token'
import { signInWithPKCE } from './pkce-flow'
import { loadTokens, saveTokens, type StoredTokens } from './token-storage'
import type { AuthConfig, AuthPermission, YVUserInfo } from './types'

const NOT_SIGNED_IN_MESSAGE = 'Sign in before requesting a YouVersion Platform permission.'

type AuthProviderProps = {
  config: AuthConfig
  appKey: string
  apiHost: string
  children: ReactNode
}

export default function AuthProvider({ config, appKey, apiHost, children }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<YVUserInfo | null>(() => loadCachedUserInfo())
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const expiryRef = useRef<Date | null>(null)
  const refreshTokenRef = useRef<string | null>(null)
  const isRefreshingRef = useRef<boolean>(false)

  const userId = userInfo?.id ?? null

  // The granted-permissions mirror is module state, not React state: a write
  // that comes back 401/403 invalidates the `highlights` grant from inside
  // `useHighlights`, which has no way to reach into this provider. Subscribing
  // means that invalidation re-renders every consumer of this context, so the
  // next tap routes to the prompt instead of failing again.
  const readGrantedPermissions = useCallback(() => getGrantedPermissions(userId), [userId])
  const grantedPermissions = useSyncExternalStore(
    subscribeGrantedPermissions,
    readGrantedPermissions,
  )

  // Read live rather than through a closure: the data-exchange session below
  // spans a browser round-trip, and the fail-closed check has to compare against
  // whoever is signed in when it RETURNS.
  const userIdRef = useRef<string | null>(userId)
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const setAuthState = useCallback(async (tokens: StoredTokens, user?: YVUserInfo) => {
    await saveTokens(tokens)
    expiryRef.current = tokens.expiryDate
    refreshTokenRef.current = tokens.refreshToken
    setAccessToken(tokens.accessToken)

    if (user) {
      setUserInfo(user)
      mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(user))
    }
  }, [])

  const clearAuthState = useCallback(async () => {
    mmkvStorage.remove(MMKV_AUTH_KEYS.cachedUserInfo)
    clearHighlightsCache()
    clearGrantedPermissions()
    expiryRef.current = null
    refreshTokenRef.current = null
    setAccessToken(null)
    setUserInfo(null)
    setError(null)
    await saveTokens({ accessToken: null, refreshToken: null, expiryDate: null })
  }, [])

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

      // Optimistic seeding: the RN sign-in carries no grant echo we can read
      // (YPE-3706), so assume requested == granted and let the first 401/403
      // correct it — see `invalidateGrantedPermission`. A fresh sign-in REPLACES
      // the recorded set rather than unioning, so a user who denies at consent
      // does not inherit a grant from a previous session. If the callback ever
      // starts returning `granted_permissions`, this one line is where it lands.
      const signedInUserId = result.userInfo.id
      if (signedInUserId) {
        saveGrantedPermissions(signedInUserId, config.permissions ?? [])
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

  const hasPermission = useCallback(
    (permission: AuthPermission) => (getGrantedPermissions(userId) ?? []).includes(permission),
    [userId],
  )

  const requestPermission = useCallback(
    async (permission: AuthPermission): Promise<RequestPermissionResult> => {
      if (accessToken === null) {
        return { kind: 'failure', message: NOT_SIGNED_IN_MESSAGE }
      }

      const initiatorUserId = userIdRef.current
      const result = await requestPermissionViaDataExchange({
        apiHost,
        appKey,
        accessToken,
        redirectUri: config.redirectUri,
        permissions: [permission],
        initiatorUserId,
        getCurrentUserId: () => userIdRef.current,
      })

      // Union rather than replace: this exchange answers only for the permission
      // it asked about, so it must not erase what the user granted at sign-in.
      if (result.kind === 'granted' && initiatorUserId !== null) {
        addGrantedPermissions(initiatorUserId, result.permissions)
      }
      return result
    },
    [accessToken, apiHost, appKey, config.redirectUri],
  )

  const value: AuthContextValue = useMemo(
    () => ({
      isAuthenticated: accessToken !== null,
      accessToken,
      userInfo,
      grantedPermissions,
      hasPermission,
      requestPermission,
      error,
      signIn,
      signOut,
      refreshNow,
      isLoading,
    }),
    [
      accessToken,
      userInfo,
      grantedPermissions,
      hasPermission,
      requestPermission,
      error,
      signIn,
      signOut,
      refreshNow,
      isLoading,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { z } from 'zod'
import { clearHighlightsCache } from '../highlights'
import { mmkvStorage } from '../storage/mmkv-storage'
import { AuthContext, type AuthContextValue } from './auth-context'
import { MMKV_AUTH_KEYS, REFRESH_LEEWAY_SECONDS } from './constants'
import {
  clearGrantedPermissions,
  loadCachedGrantedPermissions,
  saveGrantedPermissions,
} from './granted-permissions-cache'
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
  /** Bumped per signIn call so a superseded attempt can discard its result. */
  const signInEpochRef = useRef<number>(0)

  const setAuthState = useCallback(async (tokens: StoredTokens, user?: YVUserInfo) => {
    await saveTokens(tokens)
    expiryRef.current = tokens.expiryDate
    refreshTokenRef.current = tokens.refreshToken
    setAccessToken(tokens.accessToken)

    if (user) {
      setUserInfo(user)
      // Never throws, for the same reason the grant cache doesn't: the session
      // is already published two lines up, so letting a native storage failure
      // reject here would abort the caller mid-commit — signIn would skip the
      // grant it was about to record and leave the previous user's permissions
      // describing this one. The cache only seeds the first render; losing it
      // costs a cold start, not correctness.
      try {
        mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(user))
      } catch {
        // Cache write failed; the in-memory user remains authoritative.
      }
    }
  }, [])

  // Dropping a grant is always both halves: the cached entry and the in-memory
  // state hasPermission actually reads. Kept in one place so the three call
  // sites below cannot drift into clearing only one of them.
  const dropGrantedPermissions = useCallback(() => {
    clearGrantedPermissions()
    setGrantedPermissions(null)
  }, [])

  const clearAuthState = useCallback(async () => {
    // Never throws, for the same reason the grant cache doesn't. This runs
    // first, so letting a native storage failure escape would abort sign-out
    // before the grant, the highlights cache, or the tokens were cleared —
    // leaving a fully signed-in session behind a rejected signOut().
    try {
      mmkvStorage.remove(MMKV_AUTH_KEYS.cachedUserInfo)
    } catch {
      // Cache removal failed; the in-memory reset below still runs, and the
      // entry is re-validated against the schema on the next cold start.
    }
    dropGrantedPermissions()
    clearHighlightsCache()
    expiryRef.current = null
    refreshTokenRef.current = null
    setAccessToken(null)
    setUserInfo(null)
    setError(null)
    await saveTokens({ accessToken: null, refreshToken: null, expiryDate: null })
  }, [dropGrantedPermissions])

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
    // Last-to-start wins, not last-to-finish. expo-web-browser serializes the
    // consent screen itself, but once it closes the token exchange is still in
    // flight and a second sign-in can begin — and finish first. Without this,
    // the straggler writes its identity over the newer session while the newer
    // session's grant stays in state, so hasPermission answers for a user who
    // never granted it. A superseded attempt applies nothing at all, which also
    // means its stale previousUserId snapshot can do no damage.
    //
    // Checked twice, because there are two awaits to be overtaken across. The
    // second check is the narrower one — a whole interactive sign-in has to
    // finish inside one keychain write — and it cannot un-publish the identity
    // setAuthState already wrote, so it settles for dropping the grant.
    const epoch = ++signInEpochRef.current
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

      if (signInEpochRef.current !== epoch) {
        // Superseded. Resolve quietly — the newer attempt owns the outcome and
        // the user is not experiencing a failure.
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

      if (signInEpochRef.current !== epoch) {
        // Superseded *during* setAuthState's keychain write — past the check
        // above, so this attempt's identity has already published over a newer
        // one. Its grant decision cannot be trusted: `previousUserId` was
        // sampled before the newer attempt existed, so a null ("unknown") grant
        // would read as same-user and preserve the *other* account's
        // permissions next to this identity. Fail closed instead of guessing.
        dropGrantedPermissions()
        return
      }

      // The grant belongs to the session, so it lands only once the session has
      // committed: setAuthState awaits the keychain write, and if that rejects
      // no grant is left describing a sign-in that never took hold. The reverse
      // cannot happen either — neither the cache writes below nor the userInfo
      // write inside setAuthState throw, so nothing between the session going
      // live and the grant landing can reject and strand us in between.
      const nextUserId = result.userInfo.id ?? null
      // An absent id is not an identity. `YVUserInfo.id` is optional and
      // deriveUserInfo leaves it undefined when the id_token carries no string
      // `sub`, so a plain `nextUserId !== previousUserId` would rate two
      // *different* sub-less accounts as the same user and hand one's grant to
      // the other. Unidentifiable therefore never counts as same-user, and a
      // grant is never persisted under it — better to re-prompt on the next
      // cold start than to read another account's entry back as a hit.
      const isSameUser = nextUserId !== null && nextUserId === previousUserId

      if (result.grantedPermissions !== null) {
        if (nextUserId !== null) {
          saveGrantedPermissions(nextUserId, result.grantedPermissions)
        } else {
          clearGrantedPermissions()
        }
        setGrantedPermissions(result.grantedPermissions)
      } else if (!isSameUser) {
        // A `null` grant means the redirect said nothing about permissions. For
        // the same user that is "unknown" and must not wipe a real grant from an
        // earlier sign-in (this path skips clearAuthState); for a different user
        // it would hand the previous account's permissions to this one.
        dropGrantedPermissions()
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
    dropGrantedPermissions,
    userInfo?.id,
  ])

  const signOut = useCallback(async () => {
    // A sign-out is a session decision too, and it outranks any sign-in still
    // in flight: without this bump a straggler awaiting the browser or token
    // exchange passes both epoch checks and republishes its tokens and identity
    // after the user signed out. The bump lives here rather than in
    // clearAuthState so that only an explicit sign-out supersedes a pending
    // attempt — a revocation-driven clear (or bootstrap's empty-storage clear)
    // ends the *old* session and must not silently discard the new sign-in the
    // user is mid-way through.
    signInEpochRef.current += 1
    await clearAuthState()
  }, [clearAuthState])

  const refreshNow = useCallback(() => refreshToken({ force: true }), [refreshToken])

  const hasPermission = useCallback(
    (permission: AuthPermission) => grantedPermissions?.includes(permission) ?? false,
    [grantedPermissions],
  )

  const invalidatePermissions = dropGrantedPermissions

  const value: AuthContextValue = useMemo(
    () => ({
      isAuthenticated: accessToken !== null,
      accessToken,
      userInfo,
      error,
      signIn,
      signOut,
      refreshNow,
      isLoading,
      grantedPermissions,
      hasPermission,
      invalidatePermissions,
    }),
    [
      accessToken,
      userInfo,
      error,
      signIn,
      signOut,
      refreshNow,
      isLoading,
      grantedPermissions,
      hasPermission,
      invalidatePermissions,
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

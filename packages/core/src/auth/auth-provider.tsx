import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { mmkvStorage } from '../storage'
import { AuthContext, type AuthContextValue } from './auth-context'
import { MMKV_AUTH_KEYS, REFRESH_LEEWAY_SECONDS } from './constants'
import { refreshTokens, TokenEndpointError } from './http'
import { signInWithPKCE } from './pkce-flow'
import { loadTokens, saveTokens, type StoredTokens } from './token-storage'
import type { AuthConfig, YVUserInfo } from './types'

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

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const stored = await loadTokens()
        if (cancelled) {
          return
        }

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
    // Mount-only: refreshToken reads from refs, so a stale closure is safe and
    // re-running this would re-load tokens from storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      throw err
    }
  }, [apiHost, appKey, config.redirectUri, config.scopes, setAuthState])

  const signOut = useCallback(async () => {
    await clearAuthState()
  }, [clearAuthState])

  const refreshNow = useCallback(() => refreshToken({ force: true }), [refreshToken])

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
    }),
    [accessToken, userInfo, error, signIn, signOut, refreshNow, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function loadCachedUserInfo(): YVUserInfo | null {
  try {
    const userJson = mmkvStorage.getString(MMKV_AUTH_KEYS.cachedUserInfo)
    if (!userJson) {
      return null
    }
    return JSON.parse(userJson)
  } catch {
    return null
  }
}

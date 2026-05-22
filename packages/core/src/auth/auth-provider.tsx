import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { mmkvStorage } from '../storage'
import { AuthContext, type AuthContextValue } from './auth-context'
import { MMKV_AUTH_KEYS, REFRESH_LEEWAY_SECONDS } from './constants'
import { refreshTokens } from './http'
import { deriveUserInfo } from './id-token'
import { signInWithPKCE } from './pkce-flow'
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from './token-storage'
import type { AuthConfig, YVUserInfo } from './types'

type AuthProviderProps = {
  config: AuthConfig
  appKey: string
  apiHost: string
  children: ReactNode
}

export default function AuthProvider({ config, appKey, apiHost, children }: AuthProviderProps) {
  const [idToken, setIdToken] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<YVUserInfo | null>(() => loadCachedUserInfo())
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const expiryRef = useRef<Date | null>(null)
  const refreshTokenRef = useRef<string | null>(null)
  const idTokenRef = useRef<string | null>(null)
  const isRefreshingRef = useRef<boolean>(false)

  const applyTokens = useCallback(async (tokens: StoredTokens) => {
    await saveTokens(tokens)
    expiryRef.current = tokens.expiryDate
    refreshTokenRef.current = tokens.refreshToken
    idTokenRef.current = tokens.idToken
    setIdToken(tokens.idToken)
    setAccessToken(tokens.accessToken)

    if (tokens.idToken) {
      const user = deriveUserInfo(tokens.idToken)
      setUserInfo(user)
      mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(user))
    } else {
      setUserInfo(null)
      mmkvStorage.remove(MMKV_AUTH_KEYS.cachedUserInfo)
    }
  }, [])

  const refreshToken = useCallback(async () => {
    if (!expiryRef.current || !refreshTokenRef.current) {
      return
    }
    const expiresAt = expiryRef.current.getTime()

    if (expiresAt > Date.now() + REFRESH_LEEWAY_SECONDS * 1000) {
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
      await applyTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        idToken: response.id_token ?? idTokenRef.current,
        expiryDate: new Date(Date.now() + Number(response.expires_in) * 1000),
      })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      throw err
    } finally {
      isRefreshingRef.current = false
    }
  }, [apiHost, appKey, applyTokens])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const stored = await loadTokens()
        if (cancelled) {
          return
        }

        expiryRef.current = stored.expiryDate
        refreshTokenRef.current = stored.refreshToken
        idTokenRef.current = stored.idToken
        setAccessToken(stored.accessToken)
        setIdToken(stored.idToken)
        if (stored.idToken) {
          setUserInfo(deriveUserInfo(stored.idToken))

          await refreshToken()
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
    // Mount-only bootstrap: refreshToken reads from refs, so a stale closure
    // is safe and re-running this would re-load tokens from storage.
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
      await applyTokens({
        accessToken: result.tokens.access_token,
        refreshToken: result.tokens.refresh_token,
        idToken: result.tokens.id_token ?? null,
        expiryDate: new Date(Date.now() + Number(result.tokens.expires_in) * 1000),
      })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      throw err
    }
  }, [apiHost, appKey, config.redirectUri, config.scopes, applyTokens])

  const resetAuthState = useCallback(() => {
    mmkvStorage.remove(MMKV_AUTH_KEYS.cachedUserInfo)
    expiryRef.current = null
    refreshTokenRef.current = null
    idTokenRef.current = null
    setAccessToken(null)
    setUserInfo(null)
    setIdToken(null)
    setError(null)
  }, [])

  const signOut = useCallback(async () => {
    await clearTokens()
    resetAuthState()
  }, [resetAuthState])

  const value: AuthContextValue = useMemo(
    () => ({
      isAuthenticated: accessToken !== null,
      accessToken,
      idToken,
      userInfo,
      error,
      signIn,
      signOut,
      isLoading,
    }),
    [accessToken, idToken, userInfo, error, signIn, signOut, isLoading],
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

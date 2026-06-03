import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AuthProvider from './auth/auth-provider'
import type { AuthConfig } from './auth/types'
import { DEFAULT_API_HOST } from './constants'
import { getOrSetInstallationId } from './installation-id'
import { YouVersionContext } from './youversion-context'

export type YouVersionProviderProps = {
  appKey: string
  apiHost?: string
  auth?: AuthConfig
  fallback?: ReactNode
  children: ReactNode
}

export default function YouVersionProvider({
  appKey,
  apiHost = DEFAULT_API_HOST,
  auth,
  fallback = null,
  children,
}: YouVersionProviderProps) {
  const [installationId, setInstallationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const id = await getOrSetInstallationId()
        if (!cancelled) {
          setInstallationId(id)
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load installationId:', e)
        }
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  const config = useMemo(
    () =>
      installationId
        ? { installationId, appKey, apiHost, authRedirectUrl: auth?.redirectUri }
        : null,
    [installationId, appKey, apiHost, auth?.redirectUri],
  )

  if (!config) {
    return <>{fallback}</>
  }

  return (
    <YouVersionContext.Provider value={config}>
      {auth ? (
        <AuthProvider config={auth} apiHost={apiHost} appKey={appKey}>
          {children}
        </AuthProvider>
      ) : (
        children
      )}
    </YouVersionContext.Provider>
  )
}

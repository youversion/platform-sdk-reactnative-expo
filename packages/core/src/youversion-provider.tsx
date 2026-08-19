import { useMemo, useState, type ReactNode } from 'react'
import { AuthProvider } from './auth/auth-provider'
import type { AuthConfig } from './auth/types'
import { DEFAULT_API_HOST } from './constants'
import { HighlightQueueDrainHost } from './highlights/highlight-queue-drain-host'
import { getOrSetInstallationId } from './installation-id'
import type { HookOverrides } from './hook-overrides'
import { YouVersionContext } from './youversion-context'

export type YouVersionProviderProps = {
  appKey: string
  apiHost?: string
  auth?: AuthConfig
  /** Test seam: skip live fetch and return stub hook results. */
  hookOverrides?: HookOverrides
  /**
   * Kept for API compatibility. Installation ID resolution is synchronous, so
   * children render immediately and this prop is unused.
   */
  fallback?: ReactNode
  children: ReactNode
}

export default function YouVersionProvider({
  appKey,
  apiHost = DEFAULT_API_HOST,
  auth,
  fallback: _fallback = null,
  hookOverrides,
  children,
}: YouVersionProviderProps) {
  const [installationId] = useState(getOrSetInstallationId)

  const config = useMemo(
    () => ({
      installationId,
      appKey,
      apiHost,
      authRedirectUrl: auth?.redirectUri,
      hookOverrides,
    }),
    [installationId, appKey, apiHost, auth?.redirectUri, hookOverrides],
  )

  return (
    <YouVersionContext.Provider value={config}>
      {auth ? (
        <AuthProvider config={auth} apiHost={apiHost} appKey={appKey}>
          <HighlightQueueDrainHost />
          {children}
        </AuthProvider>
      ) : (
        children
      )}
    </YouVersionContext.Provider>
  )
}

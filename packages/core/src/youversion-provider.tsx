import { useMemo, useState, type ReactNode } from 'react'
import { AuthProvider } from './auth/auth-provider'
import type { AuthConfig } from './auth/types'
import { createBibleContentClient } from './bible-content/client'
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
  /** Version filter: unset = no restriction; `[]` = permit nothing. Forwarded to web SDK. */
  permittedVersionIds?: number[]
  /** Version filter: excluded version ids win over permits. Forwarded to web SDK. */
  excludedVersionIds?: number[]
  /** Version filter: BCP 47 language tags (e.g. `en`, `zh-Hans`). */
  permittedLanguageTags?: string[]
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
  permittedVersionIds,
  excludedVersionIds,
  permittedLanguageTags,
  fallback: _fallback = null,
  hookOverrides,
  children,
}: YouVersionProviderProps): ReactNode {
  const [installationId] = useState(getOrSetInstallationId)

  const fetchBibleContent = useMemo(
    () => createBibleContentClient({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )

  const config = useMemo(
    () => ({
      installationId,
      appKey,
      apiHost,
      fetchBibleContent,
      authRedirectUrl: auth?.redirectUri,
      hookOverrides,
      permittedVersionIds,
      excludedVersionIds,
      permittedLanguageTags,
    }),
    [
      installationId,
      appKey,
      apiHost,
      fetchBibleContent,
      auth?.redirectUri,
      hookOverrides,
      permittedVersionIds,
      excludedVersionIds,
      permittedLanguageTags,
    ],
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

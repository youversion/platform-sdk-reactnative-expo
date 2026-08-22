import {
  YouVersionProvider as CoreYouVersionProvider,
  type AuthConfig,
  type HookOverrides,
} from '@youversion/platform-react-native-expo-core'
import { type ReactNode } from 'react'
import * as ReactNative from 'react-native'
import { ThemeContext } from '../hooks/use-theme'
import { LocaleProvider } from '../i18n/locale-context'
import { resolveTheme, type Theme } from '../lib/resolve-theme'
import { NativeSheetProvider } from './native-sheet'

export type YouVersionTheme = Theme | 'system'

export type YouVersionProviderProps = {
  appKey: string
  apiHost?: string
  theme?: YouVersionTheme
  /** When omitted, native SDK strings follow the device locale (expo-localization). */
  locale?: string
  auth?: AuthConfig
  /** Version filter: unset = no restriction; `[]` = permit nothing. Forwarded to core. */
  permittedVersionIds?: number[]
  /** Version filter: excluded version ids win over permits. Forwarded to core. */
  excludedVersionIds?: number[]
  /** Version filter: BCP 47 language tags (e.g. `en`, `zh-Hans`). Forwarded to core. */
  permittedLanguageTags?: string[]
  fallback?: ReactNode
  /** Test seam: skip live fetch and return stub hook results. */
  hookOverrides?: HookOverrides
  children: ReactNode
}

export function YouVersionProvider({
  appKey,
  apiHost,
  theme = 'system',
  locale,
  auth,
  permittedVersionIds,
  excludedVersionIds,
  permittedLanguageTags,
  fallback,
  hookOverrides,
  children,
}: YouVersionProviderProps): ReactNode {
  const colorScheme = ReactNative.useColorScheme()
  const resolvedTheme = resolveTheme(theme, colorScheme)

  return (
    <CoreYouVersionProvider
      appKey={appKey}
      apiHost={apiHost}
      auth={auth}
      fallback={fallback}
      hookOverrides={hookOverrides}
      permittedVersionIds={permittedVersionIds}
      excludedVersionIds={excludedVersionIds}
      permittedLanguageTags={permittedLanguageTags}
    >
      <LocaleProvider locale={locale}>
        <ThemeContext.Provider value={resolvedTheme}>
          <NativeSheetProvider>{children}</NativeSheetProvider>
        </ThemeContext.Provider>
      </LocaleProvider>
    </CoreYouVersionProvider>
  )
}

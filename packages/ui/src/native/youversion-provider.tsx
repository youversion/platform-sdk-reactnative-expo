import {
  YouVersionProvider as CoreYouVersionProvider,
  type AuthConfig,
} from '@youversion/platform-react-native-expo-core'
import { createContext, use, type ReactNode } from 'react'
import * as ReactNative from 'react-native'
import { resolveTheme, type Theme, type ThemeInput } from '../lib/resolve-theme'
import { NativeSheetProvider } from './native-sheet'

export type YouVersionTheme = Theme | 'system'

const ThemeContext = createContext<Theme>('light')

export type YouVersionProviderProps = {
  appKey: string
  apiHost?: string
  theme?: YouVersionTheme
  auth?: AuthConfig
  fallback?: ReactNode
  children: ReactNode
}

export function YouVersionProvider({
  appKey,
  apiHost,
  theme = 'system',
  auth,
  fallback,
  children,
}: YouVersionProviderProps) {
  const colorScheme = ReactNative.useColorScheme()
  const resolvedTheme = resolveTheme(theme, colorScheme)

  return (
    <CoreYouVersionProvider appKey={appKey} apiHost={apiHost} auth={auth} fallback={fallback}>
      <ThemeContext.Provider value={resolvedTheme}>
        <NativeSheetProvider>{children}</NativeSheetProvider>
      </ThemeContext.Provider>
    </CoreYouVersionProvider>
  )
}

export function useTheme(override?: ThemeInput): Theme {
  const providerTheme = use(ThemeContext)
  return override === 'system' ? providerTheme : (override ?? providerTheme)
}

/**
 * Resolves a component-level theme override against the provider theme so each
 * sheet/component doesn't hand-roll the same fallback. `'system'` (or omitting
 * the override) follows the provider; an explicit `'light'`/`'dark'` wins.
 */
export function useResolvedTheme(override?: ThemeInput): Theme {
  const providerTheme = useTheme()
  return override === 'system' ? providerTheme : (override ?? providerTheme)
}

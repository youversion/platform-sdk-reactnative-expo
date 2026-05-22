import {
  YouVersionProvider as CoreYouVersionProvider,
  type AuthConfig,
} from '@youversion/platform-react-native-expo-core'
import { createContext, useContext, type ReactNode } from 'react'
import * as ReactNative from 'react-native'
import { resolveTheme } from '../lib/resolve-theme'
import { NativeSheetProvider } from './native-sheet'

type Theme = 'light' | 'dark'
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
  theme = 'light',
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

export function useTheme(): Theme {
  return useContext(ThemeContext)
}

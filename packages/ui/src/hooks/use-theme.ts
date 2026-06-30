import { createContext, use } from 'react'
import type { ThemeInput } from '../lib/resolve-theme'

export type Theme = 'light' | 'dark'

export const ThemeContext = createContext<Theme>('light')

export function useTheme(override?: ThemeInput): Theme {
  const providerTheme = use(ThemeContext)
  return override === 'system' ? providerTheme : (override ?? providerTheme)
}

import { getTokens, type Tokens } from '../theme'
import { useTheme } from './use-theme'

/**
 * Design tokens for the scheme `YouVersionProvider` resolved.
 * Outside a provider, `ThemeContext` defaults to light.
 */
export function useTokens(): Tokens {
  const theme = useTheme()
  return getTokens(theme)
}

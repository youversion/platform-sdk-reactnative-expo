import { getTokens, type Tokens } from '../theme'
import { useTheme } from './use-theme'

/**
 * Design tokens for the color scheme resolved by `YouVersionProvider`.
 * Outside a provider, defaults to light.
 */
export function useTokens(): Tokens {
  const theme = useTheme()
  return getTokens(theme)
}

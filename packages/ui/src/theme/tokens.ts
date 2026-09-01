import type { Theme } from '../lib/resolve-theme'
import { fontFamily, radius, typography } from './scales'
import { semanticColors } from './semantic'
import type { SemanticColors } from './semantic'

export interface Tokens extends SemanticColors {
  readonly radius: typeof radius
  readonly fontFamily: typeof fontFamily
  readonly typography: typeof typography
}

const light: Tokens = Object.freeze({ ...semanticColors.light, radius, fontFamily, typography })
const dark: Tokens = Object.freeze({ ...semanticColors.dark, radius, fontFamily, typography })

export function getTokens(scheme: Theme): Tokens {
  if (scheme === 'dark') {
    return dark
  }
  return light
}

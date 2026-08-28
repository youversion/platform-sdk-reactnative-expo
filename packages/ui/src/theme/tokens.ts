import type { Theme } from '../lib/resolve-theme'
import { fontFamily, radius } from './scales'
import { semanticColors } from './semantic'
import type { SemanticColors } from './semantic'

export interface Tokens extends SemanticColors {
  readonly radius: typeof radius
  readonly fontFamily: typeof fontFamily
}

const light: Tokens = Object.freeze({ ...semanticColors.light, radius, fontFamily })
const dark: Tokens = Object.freeze({ ...semanticColors.dark, radius, fontFamily })

export function getTokens(scheme: Theme): Tokens {
  if (scheme === 'dark') {
    return dark
  }
  return light
}

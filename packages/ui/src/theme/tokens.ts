import { fontFamily, radius } from './scales'
import { semanticColors } from './semantic'
import type { SemanticColors } from './semantic'

export interface Tokens extends SemanticColors {
  radius: { sm: number; md: number; lg: number; xl: number }
  fontFamily: { sans: string; serif: string }
}

const light: Tokens = { ...semanticColors.light, radius, fontFamily }
const dark: Tokens = { ...semanticColors.dark, radius, fontFamily }

export function getTokens(scheme: 'light' | 'dark'): Tokens {
  if (scheme === 'dark') {
    return dark
  }
  return light
}

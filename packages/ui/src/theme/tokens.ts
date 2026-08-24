import { fontFamily, radius } from './scales'
import { semantic } from './semantic'
import type { SemanticColors } from './semantic'

export type Tokens = SemanticColors & {
  radius: { sm: number; md: number; lg: number; xl: number }
  fontFamily: { sans: string; serif: string }
}

const light: Tokens = { ...semantic.light, radius, fontFamily }
const dark: Tokens = { ...semantic.dark, radius, fontFamily }

export function getTokens(scheme: 'light' | 'dark'): Tokens {
  if (scheme === 'dark') {
    return dark
  }
  return light
}

export const radius = Object.freeze({
  sm: 28,
  md: 30,
  lg: 32,
  xl: 36,
} as const)

export const fontFamily = Object.freeze({
  sans: 'Inter',
  serif: 'Untitled Serif',
} as const)

// Web text-sm/base/lg converted at 16dp per CSS unit. Add a step only with
// the component that needs it.
export const typography = Object.freeze({
  sm: Object.freeze({ fontSize: 14, lineHeight: 20 } as const),
  base: Object.freeze({ fontSize: 16, lineHeight: 24 } as const),
  lg: Object.freeze({ fontSize: 18, lineHeight: 28 } as const),
} as const)

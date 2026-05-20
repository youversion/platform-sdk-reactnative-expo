export type Theme = 'light' | 'dark'
export type ThemeInput = Theme | 'system'

export function resolveTheme(
  theme: ThemeInput,
  colorScheme: string | null | undefined,
): Theme {
  return theme === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : theme
}

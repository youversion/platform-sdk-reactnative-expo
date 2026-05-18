import { resolveTheme } from '../resolve-theme'

describe('resolveTheme', () => {
  it('returns explicit light or dark themes unchanged', () => {
    expect(resolveTheme('light', 'dark')).toBe('light')
    expect(resolveTheme('dark', 'light')).toBe('dark')
  })

  it('resolves system to dark when the color scheme is dark', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
  })

  it('resolves system to light for any non-dark color scheme', () => {
    expect(resolveTheme('system', 'light')).toBe('light')
    expect(resolveTheme('system', null)).toBe('light')
    expect(resolveTheme('system', undefined)).toBe('light')
  })
})

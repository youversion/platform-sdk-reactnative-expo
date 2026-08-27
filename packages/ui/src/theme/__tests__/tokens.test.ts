import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { palette } from '../palette'
import { getTokens } from '../tokens'

describe('getTokens', () => {
  it('uses the web radius ramp in density-independent pixels', () => {
    const { radius } = getTokens('light')

    expect(radius.sm).toBe(28)
    expect(radius.md).toBe(30)
    expect(radius.lg).toBe(32)
    expect(radius.xl).toBe(36)
  })

  it('returns the same object for repeat calls of a scheme', () => {
    expect(getTokens('light')).toBe(getTokens('light'))
    expect(getTokens('dark')).toBe(getTokens('dark'))
    expect(getTokens('light')).not.toBe(getTokens('dark'))
  })

  it('freezes the cached token objects so callers cannot rewrite colors', () => {
    const tokens = getTokens('light')

    expect(Object.isFrozen(tokens)).toBe(true)
    expect(Object.isFrozen(tokens.radius)).toBe(true)
    expect(Object.isFrozen(tokens.fontFamily)).toBe(true)
  })

  it('maps light semantic colors from the web default theme', () => {
    const tokens = getTokens('light')

    expect(tokens.background).toBe(palette.white)
    expect(tokens.background).toBe('#ffffff')
    expect(tokens.primary).toBe(palette.gray50)
    expect(tokens.primary).toBe('#121212')
    expect(tokens.mutedForeground).toBe(palette.gray30)
    expect(tokens.mutedForeground).toBe('#636161')
    expect(tokens.wj).toBe(palette.wj)
    expect(tokens.wj).toBe('#94000c')
  })

  it('maps dark semantic colors from the web dark theme', () => {
    const tokens = getTokens('dark')

    expect(tokens.background).toBe(palette.gray50)
    expect(tokens.background).toBe('#121212')
    expect(tokens.primary).toBe(palette.redDarkMode)
    expect(tokens.primary).toBe('#f04c59')
    expect(tokens.mutedForeground).toBe(palette.gray10)
    expect(tokens.mutedForeground).toBe('#edebeb')
    expect(tokens.wj).toBe(palette.wjDm)
    expect(tokens.wj).toBe('#e4bfc2')
  })

  it('keeps token module source free of CSS color functions and rem units', () => {
    const themeDir = join(__dirname, '..')
    const files = readdirSync(themeDir).filter((name) => name.endsWith('.ts'))

    expect(files.length).toBeGreaterThan(0)

    for (const name of files) {
      const source = readFileSync(join(themeDir, name), 'utf8')
      expect(source).not.toContain('oklch(')
      expect(source).not.toContain('rgb(')
      expect(source).not.toContain('rem')
    }
  })
})

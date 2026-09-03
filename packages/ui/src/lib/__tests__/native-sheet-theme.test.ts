import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getTokens, palette } from '../../theme'
import { withAlpha } from '../color'
import {
  SHEET_FOREGROUND,
  SHEET_HANDLE,
  SHEET_INVERSE_FOREGROUND,
  SHEET_MUTED_BACKGROUND,
  SHEET_MUTED_FOREGROUND,
  SHEET_STROKE,
  SHEET_SURFACE,
  SHEET_TOP_SHADOW,
} from '../native-sheet-theme'

const light = getTokens('light')
const dark = getTokens('dark')

describe('native-sheet-theme', () => {
  it('derives surface and type colors from semantic tokens in both schemes', () => {
    expect(SHEET_SURFACE).toEqual({ light: light.background, dark: dark.background })
    expect(SHEET_MUTED_BACKGROUND).toEqual({ light: light.muted, dark: dark.muted })
    expect(SHEET_FOREGROUND).toEqual({ light: light.foreground, dark: dark.foreground })
    expect(SHEET_INVERSE_FOREGROUND).toEqual({ light: light.background, dark: dark.background })
    expect(SHEET_MUTED_FOREGROUND).toEqual({
      light: light.mutedForeground,
      dark: dark.mutedForeground,
    })
  })

  it('maps the handle to palette gray20 / gray30, not a new sheet token', () => {
    expect(SHEET_HANDLE).toEqual({ light: palette.gray20, dark: palette.gray30 })
  })

  it('builds stroke and light shadows from foreground alpha, and dark shadows from black', () => {
    expect(SHEET_STROKE).toEqual({
      light: withAlpha(light.foreground, 0.2),
      dark: withAlpha(dark.foreground, 0.2),
    })
    expect(SHEET_TOP_SHADOW.light).toEqual([
      { offsetX: 0, offsetY: -2, blurRadius: 4, color: withAlpha(light.foreground, 0.06) },
      { offsetX: 0, offsetY: -16, blurRadius: 32, color: withAlpha(light.foreground, 0.14) },
    ])
    expect(SHEET_TOP_SHADOW.dark).toEqual([
      { offsetX: 0, offsetY: -2, blurRadius: 4, color: 'rgba(0, 0, 0, 0.5)' },
      { offsetX: 0, offsetY: -16, blurRadius: 32, color: 'rgba(0, 0, 0, 0.7)' },
    ])
  })

  it('keeps native-sheet-theme.ts free of copied hex literals', () => {
    const source = readFileSync(join(__dirname, '..', 'native-sheet-theme.ts'), 'utf8')

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

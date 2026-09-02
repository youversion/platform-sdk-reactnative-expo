/**
 * Seam 5 of YPE-5059: the pinned `@youversion/platform-react-ui` owns reader
 * fill and Words of Christ. Native HIGHLIGHT_COLORS must match that release.
 * This file lives in ui so core never imports platform-react-ui (react-dom peer).
 */
import { HIGHLIGHT_COLORS as nativeHighlightColors } from '@youversion/platform-react-native-expo-core'
import { HIGHLIGHT_COLORS as webHighlightColors } from '@youversion/platform-react-ui'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(__filename)

const SIX = ['ffec5b', 'b4ffc1', 'bbf4ff', 'ffdca7', 'ffcff8', 'dfdcff'] as const
const OLD_FIVE = ['fffe00', '5dff79', '00d6ff', 'ffc66f', 'ff95ef'] as const

function pinnedWebStyles(): string {
  return readFileSync(require.resolve('@youversion/platform-react-ui/styles.css'), 'utf8')
}

describe('pinned platform-react-ui 2.12.0 (YPE-5058 / YPE-5059)', () => {
  it('matches native HIGHLIGHT_COLORS to the six in 2.12.0', () => {
    expect(webHighlightColors).toEqual([...SIX])
    expect(nativeHighlightColors).toEqual([...webHighlightColors])
  })

  it('keeps the old five out of apply — they are leftover paint/clear only', () => {
    for (const color of OLD_FIVE) {
      expect(webHighlightColors).not.toContain(color)
      expect(nativeHighlightColors).not.toContain(color)
    }
  })

  it('pins Words of Christ as unmixed #94000C / #e4bfc2', () => {
    const css = pinnedWebStyles().toLowerCase()

    expect(css).toContain('#94000c')
    expect(css).toContain('#e4bfc2')
  })
})

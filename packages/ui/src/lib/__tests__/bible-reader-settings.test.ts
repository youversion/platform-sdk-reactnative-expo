/**
 * Pins reader settings behavior to `@youversion/platform-react-ui` 2.17.0.
 * Native code does not import that package; this test does, on purpose.
 */
import {
  BIBLE_READER_FONT as webFont,
  clampBibleReaderFontSize as webClamp,
  createBibleThemeSettingsContentHandlers as webHandlers,
} from '@youversion/platform-react-ui'

import {
  BIBLE_READER_FONT,
  clampBibleReaderFontSize,
  createBibleThemeSettingsContentHandlers,
} from '../bible-reader-settings'
import { INTER_FONT } from '../reader-fonts'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'

describe('bible reader settings', () => {
  it('matches the Web SDK font bounds', () => {
    expect(BIBLE_READER_FONT).toEqual(webFont)
  })

  it('clamps font size the same way', () => {
    const samples = [0, 11.9, 12, 16, 20, 100, Number.NaN]
    for (const sample of samples) {
      expect(clampBibleReaderFontSize(sample)).toBe(webClamp(sample))
    }
  })

  it('steps size and line spacing the same way', () => {
    let localSize: number = BIBLE_READER_FONT.DEFAULT
    let webSize: number = webFont.DEFAULT
    let localSpacing: number = READER_LINE_SPACING.DEFAULT
    let webSpacing: number = READER_LINE_SPACING.DEFAULT
    const local = createBibleThemeSettingsContentHandlers({
      getFontSize: () => localSize,
      getFontFamily: () => INTER_FONT,
      setFontSize: (size) => {
        localSize = size
      },
      setFontFamily: () => undefined,
      getLineSpacing: () => localSpacing,
      setLineSpacing: (size) => {
        localSpacing = size
      },
    })
    const web = webHandlers({
      getFontSize: () => webSize,
      getFontFamily: () => INTER_FONT,
      setFontSize: (size) => {
        webSize = size
      },
      setFontFamily: () => undefined,
      getLineSpacing: () => webSpacing,
      setLineSpacing: (size) => {
        webSpacing = size
      },
    })

    local.onFontIncreased()
    web.onFontIncreased()
    expect(localSize).toBe(webSize)
    expect(localSize).toBe(BIBLE_READER_FONT.DEFAULT + BIBLE_READER_FONT.STEP)

    while (localSize > BIBLE_READER_FONT.MIN) {
      local.onFontDecreased()
      web.onFontDecreased()
      expect(localSize).toBe(webSize)
    }
    expect(localSize).toBe(BIBLE_READER_FONT.MIN)

    local.onChangeLineSpacing()
    web.onChangeLineSpacing()
    expect(localSpacing).toBe(webSpacing)
    expect(localSpacing).toBe(READER_LINE_SPACING.LG)

    local.onChangeLineSpacing()
    web.onChangeLineSpacing()
    expect(localSpacing).toBe(webSpacing)
    expect(localSpacing).toBe(READER_LINE_SPACING.SM)

    local.onChangeLineSpacing()
    web.onChangeLineSpacing()
    expect(localSpacing).toBe(webSpacing)
    expect(localSpacing).toBe(READER_LINE_SPACING.DEFAULT)
  })
})

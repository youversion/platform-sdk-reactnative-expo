import type { FontFamily } from './reader-fonts'
import { READER_LINE_SPACING } from '../stores/types/reader-line-spacing'

/**
 * Font size bounds for the native reader. Same numbers as
 * `@youversion/platform-react-ui` `BIBLE_READER_FONT` in 2.17.0.
 */
export const BIBLE_READER_FONT = {
  MIN: 12,
  MAX: 20,
  DEFAULT: 16,
  STEP: 2,
} as const

export function clampBibleReaderFontSize(fontSize: number): number {
  return Math.min(BIBLE_READER_FONT.MAX, Math.max(BIBLE_READER_FONT.MIN, fontSize))
}

function nextBibleReaderFontSizeUp(current: number): number {
  return clampBibleReaderFontSize(current + BIBLE_READER_FONT.STEP)
}

function nextBibleReaderFontSizeDown(current: number): number {
  return clampBibleReaderFontSize(current - BIBLE_READER_FONT.STEP)
}

/** DEFAULT → large → small → DEFAULT. Same cycle as the Web SDK. */
function changeBibleReaderLineSpacing(current: number): number {
  switch (current) {
    case READER_LINE_SPACING.DEFAULT:
      return READER_LINE_SPACING.LG
    case READER_LINE_SPACING.LG:
      return READER_LINE_SPACING.SM
    default:
      return READER_LINE_SPACING.DEFAULT
  }
}

export type BibleThemeSettingsHandlers = {
  onFontIncreased: () => void
  onFontDecreased: () => void
  onFontSelected: (fontFamily: FontFamily) => void
  onChangeLineSpacing: () => void
}

/**
 * Font, size, and line-spacing handlers for the native settings sheet.
 * Same steps as the Web SDK's `createBibleThemeSettingsContentHandlers`.
 */
export function createBibleThemeSettingsContentHandlers(options: {
  getFontSize: () => number
  getFontFamily: () => FontFamily
  setFontSize: (size: number) => void
  setFontFamily: (fontFamily: FontFamily) => void
  getLineSpacing: () => number
  setLineSpacing: (size: number) => void
}): BibleThemeSettingsHandlers {
  return {
    onFontIncreased: (): void => {
      options.setFontSize(nextBibleReaderFontSizeUp(options.getFontSize()))
    },
    onFontDecreased: (): void => {
      options.setFontSize(nextBibleReaderFontSizeDown(options.getFontSize()))
    },
    onFontSelected: (fontFamily: FontFamily): void => {
      options.setFontFamily(fontFamily)
    },
    onChangeLineSpacing: (): void => {
      options.setLineSpacing(changeBibleReaderLineSpacing(options.getLineSpacing()))
    },
  }
}

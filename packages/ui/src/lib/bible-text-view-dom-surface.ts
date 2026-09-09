import { decodeFontFamilyFromDom, type FontFamily, type FontFamilyToken } from './reader-fonts'

export type BibleTextViewDomSurface = {
  theme: 'light' | 'dark'
  fontFamily: FontFamily | undefined
  fontSize: number | undefined
}

/**
 * Props the DOM BibleTextView entry hands to the in-WebView provider and the
 * Web SDK. Fonts stay on those components — this object never carries
 * `--yv-reader-*` CSS.
 */
export function bibleTextViewDomSurface(input: {
  theme?: 'light' | 'dark'
  fontFamily?: FontFamilyToken
  fontSize?: number
}): BibleTextViewDomSurface {
  return {
    theme: input.theme ?? 'light',
    fontFamily: decodeFontFamilyFromDom(input.fontFamily),
    fontSize: input.fontSize,
  }
}

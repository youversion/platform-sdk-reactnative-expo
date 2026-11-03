import { deriveServerColors, type Highlight } from '@youversion/platform-react-native-expo-core'
import { useMemo } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { useTokens } from '../../hooks/use-tokens'
import { INTER_FONT, type FontFamily } from '../../lib/reader-fonts'
import { sansFace } from '../../theme/fonts'
import { useSerifFace } from '../../theme/use-fonts'
import { highlightPaint, type HighlightPaint } from './highlight-colors'
import type { PassageLook } from './passage'
import type { LoadedPassage } from './use-passage'

export type PassageStyleInput = {
  /** The passage on screen. Its rtl vote and its scope drive look and paint. */
  passage: LoadedPassage | null
  highlights: readonly Highlight[]
  fontSize: number
  /** Line box as a multiple of `fontSize`. */
  lineMultiple: number
  /** Inter draws sans. Every other stack draws the reader serif. */
  fontFamily: FontFamily | undefined
  /** Overrides the passage's own strong-letter vote. */
  direction?: 'ltr' | 'rtl'
  /** `#rrggbb`. Defaults to the scheme's foreground. */
  ink?: string
  /** `#rrggbb` under the text. Highlight covers paint it. Defaults to the scheme's background. */
  background?: string
}

export type PassageStyle = {
  look: PassageLook
  /** Verse to fill, scoped to `passage`. */
  paint: ReadonlyMap<number, HighlightPaint>
}

/** The reader's look and highlight paint for any passage, in the `ThemeContext` scheme. */
export function usePassageStyle({
  passage,
  highlights,
  fontSize,
  lineMultiple,
  fontFamily,
  direction,
  ink: inkOverride,
  background: backgroundOverride,
}: PassageStyleInput): PassageStyle {
  const theme = useTheme()
  const tokens = useTokens()
  const serifFaceFor = useSerifFace()
  const ink = inkOverride ?? tokens.foreground
  const background = backgroundOverride ?? tokens.background
  const isSans = fontFamily === INTER_FONT
  const rtl = direction === undefined ? (passage?.parsed.rtl ?? false) : direction === 'rtl'

  // Highlights stay out of the deps, so a new highlight keeps `look`'s identity.
  const look = useMemo<PassageLook>(
    () => ({
      fontSize,
      lineMultiple,
      rtl,
      // Inter ships no italic here, so sans keeps the upright face.
      face: (weight, italic) =>
        isSans
          ? sansFace(tokens.fontFamily.sans, weight)
          : serifFaceFor(weight, italic ? 'italic' : 'normal'),
      labelFace: sansFace(tokens.fontFamily.sans, 400),
      ink,
      wj: tokens.wj,
      underline: tokens.border,
      background,
    }),
    [fontSize, lineMultiple, rtl, isSans, tokens, serifFaceFor, ink, background],
  )

  // Scoped to the rendered passage: the old one stays up while the next one loads.
  const paint = useMemo(() => {
    if (passage === null) {
      return new Map<number, HighlightPaint>()
    }
    const colors = deriveServerColors(Array.isArray(highlights) ? highlights : [], {
      versionId: passage.versionId,
      book: passage.book,
      chapter: passage.chapter,
    })
    const byColor = new Map<string, HighlightPaint>()
    const map = new Map<number, HighlightPaint>()
    for (const [verse, color] of Object.entries(colors)) {
      const fill =
        byColor.get(color) ?? highlightPaint(color, theme, background, tokens.primaryForeground)
      byColor.set(color, fill)
      map.set(Number(verse), fill)
    }
    return map
  }, [highlights, passage, theme, background, tokens.primaryForeground])

  return { look, paint }
}

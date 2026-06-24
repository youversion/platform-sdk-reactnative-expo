import type { ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { INTER_FONT, SOURCE_SERIF_FONT } from '../../lib/reader-fonts'
import type { Theme } from '../../lib/resolve-theme'
import { useReaderSettingsStore } from '../../stores/reader-settings-store'
import { NativeSheet } from '../native-sheet'
import { MIDTEXT_SUPERSCRIPT_RISE_EM, Superscript } from './baseline-shift'
import { resolveBodyFontFamily, resolveLabelFontFamily } from './scripture-fonts'
import { SCRIPTURE_PALETTE } from './scripture-theme'
import {
  type ScriptureFootnote,
  type ScriptureVerseToken,
  renderFootnoteHtml,
} from './scripture-renderer'

// The verse text uses the reader's font size; the reference (`1rem`) and notes
// (`text-xs` = `0.75rem`) are fixed, like the Web SDK's FootnoteContent — they do
// not scale with the reader size.
const REFERENCE_FONT_SIZE = 16
const NOTE_FONT_SIZE = 12

export type ScriptureFootnoteSheetProps = {
  /** Footnote to display, or `null` when none has been opened yet. */
  footnote: ScriptureFootnote | null
  /** Re-open signal: bump on every marker tap so repeated taps re-snap open. */
  openKey: number
  onClose: () => void
  theme: Theme
  /** Verse-text size override; defaults to the reader's current font size. */
  fontSize?: number
}

/**
 * Render the verse text with a superscript letter at each note's position. Uses the
 * shared `Superscript` with the **same label (Inter) font** as the reader's verse
 * numbers. The font matters: it carries the vertical metrics the rise was tuned
 * against, so passing it keeps the letters from dropping (omitting it falls back to
 * the system font, whose different metrics drop the glyph). These letters sit
 * mid-text rather than at the line lead, so they take `MIDTEXT_SUPERSCRIPT_RISE_EM`
 * — a higher lift than the verse-number default — to ride near the cap height.
 */
function renderVerseTokens(tokens: ScriptureVerseToken[], fontSize: number, color: string): ReactNode[] {
  const out: ReactNode[] = []
  tokens.forEach((token, index) => {
    if (token.type === 'text') {
      out.push(token.text)
    } else {
      out.push(
        <Superscript
          key={`n${index}`}
          fontSize={fontSize}
          color={color}
          fontFamily={resolveLabelFontFamily()}
          riseEm={MIDTEXT_SUPERSCRIPT_RISE_EM}
        >
          {token.letter}
        </Superscript>,
      )
    }
  })
  return out
}

/**
 * Fully native footnote drawer — the non-WebView analog of the DOM
 * `FootnoteContent` sheet, matching its layout/styling: a **bold sans** verse
 * reference, the **serif** verse text (with a superscript letter at each note's
 * position), then the verse's notes below — each a small **sans** row prefixed
 * with its matching letter and divided by a hairline border. The renderer supplies
 * all of this as plain data, so the drawer needs no DOM/WebView; it renders in the
 * shared `NativeSheet` (a `@gorhom/bottom-sheet`), keeping the reading surface
 * WebView-free (ADR 0010).
 */
export function ScriptureFootnoteSheet({
  footnote,
  openKey,
  onClose,
  theme,
  fontSize,
}: ScriptureFootnoteSheetProps) {
  const settings = useReaderSettingsStore()
  const palette = SCRIPTURE_PALETTE[theme]
  const referenceFont = resolveLabelFontFamily({ bold: true })
  const noteMarkerFont = resolveLabelFontFamily()
  const verseFont = resolveBodyFontFamily(SOURCE_SERIF_FONT)
  // Match the reader's verse size and line spacing so the drawer renders like the
  // page — and so the in-verse superscript letters sit in the same line box the
  // shared `Superscript` was tuned against (see SUPERSCRIPT_RISE_EM).
  const verseFontSize = fontSize ?? settings.fontSize
  const verseLineHeight = verseFontSize * settings.lineSpacing

  // Renderer builds `${reference}:${verseNum}`; fall back to the verse number when
  // no passage reference is known (e.g. the offline `html` path).
  const reference =
    footnote?.reference ?? (footnote?.verseNumber ? `Verse ${footnote.verseNumber}` : null)
  const verseTokens = footnote?.verseTokens ?? []
  const notes = footnote?.notes ?? []

  return (
    <NativeSheet isOpen={!!footnote} openKey={openKey} onClose={onClose} theme={theme}>
      <ScrollView
        style={{ maxHeight: 400 }}
        contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 12 }}
      >
        {reference != null && (
          <Text
            style={{
              fontFamily: referenceFont,
              fontWeight: 'bold',
              fontSize: REFERENCE_FONT_SIZE,
              color: palette.foreground,
              marginBottom: 8,
            }}
          >
            {reference}
          </Text>
        )}

        {verseTokens.length > 0 && (
          <Text
            style={{
              fontFamily: verseFont,
              fontSize: verseFontSize,
              lineHeight: verseLineHeight,
              color: palette.foreground,
              marginBottom: 12,
            }}
          >
            {renderVerseTokens(verseTokens, verseFontSize, palette.mutedForeground)}
          </Text>
        )}

        <View>
          {notes.map((note) => {
            const html = note.html?.trim()
            // Notes render in the sans family to match the Web SDK's footnote list.
            const body = html
              ? renderFootnoteHtml(html, {
                  theme,
                  fontSize: NOTE_FONT_SIZE,
                  fontFamily: INTER_FONT,
                })
              : note.text
            return (
              <View
                key={note.letter}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: noteMarkerFont,
                    fontSize: NOTE_FONT_SIZE,
                    color: palette.foreground,
                    marginRight: 8,
                  }}
                >
                  {note.letter}.
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: resolveBodyFontFamily(INTER_FONT),
                    fontSize: NOTE_FONT_SIZE,
                    lineHeight: NOTE_FONT_SIZE * 1.5,
                    color: palette.foreground,
                  }}
                >
                  {body}
                </Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </NativeSheet>
  )
}

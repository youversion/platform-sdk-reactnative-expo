import type { FootnoteData } from '@youversion/platform-react-ui'
import { useMemo, type ReactNode } from 'react'
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '../components/ui'
import { ThemeContext, useTokens } from '../hooks'
import { footnoteMarker } from '../lib/footnote-html'
import { READER_LINE_SPACING } from '../stores/types/reader-line-spacing'
import { sansFace, type FontFace } from '../theme/fonts'
import { useSerifFace, type SerifFaceFor } from '../theme/use-fonts'
import { isRtlRuns, parseNoteHtml, type NoteRun } from './scripture/parse-passage'
import { smallCaps } from './scripture/passage'
import { LABEL_SCALE, lineMultiple, resolveChars } from './scripture/styles'

type FootnoteContentProps = {
  data: FootnoteData
  theme?: 'light' | 'dark'
  /** Appended to the heading, as Swift's `displayTitle(for:)` does. */
  versionAbbreviation?: string
  scriptureDirection?: 'ltr' | 'rtl'
  /** The reader's line spacing, so the sheet keeps its leading. */
  lineSpacing?: number
}

// Swift's footnote sheet renders verse and notes in Untitled Serif at a fixed 16pt, whatever the
// reader size; `.footnote` only sizes the marker.
const VERSE_FONT_SIZE = 16
// YouVersionFonts.labelSmall: system 11 medium.
const LABEL_FONT_SIZE = 11
const SUP_RAISE_EM = 0.5
// Gorhom's default handle. NativeSheet draws the bottom safe area under the
// content, so this height plus both insets is the space the sheet cannot use.
const SHEET_HANDLE_HEIGHT = 24

export default function FootnoteContent({
  data,
  theme = 'light',
  versionAbbreviation,
  scriptureDirection,
  lineSpacing = READER_LINE_SPACING.DEFAULT,
}: FootnoteContentProps): ReactNode {
  return (
    <ThemeContext.Provider value={theme}>
      <FootnoteBody
        data={data}
        versionAbbreviation={versionAbbreviation}
        direction={scriptureDirection}
        lineHeight={VERSE_FONT_SIZE * lineMultiple(lineSpacing)}
      />
    </ThemeContext.Provider>
  )
}

function FootnoteBody({
  data,
  versionAbbreviation,
  direction,
  lineHeight,
}: {
  data: FootnoteData
  versionAbbreviation: string | undefined
  direction: 'ltr' | 'rtl' | undefined
  lineHeight: number
}): ReactNode {
  const tokens = useTokens()
  const serifFaceFor = useSerifFace()
  const { height: windowHeight } = useWindowDimensions()
  const { top, bottom } = useSafeAreaInsets()
  const topGap = Math.max(top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0)
  const maxHeight = Math.max(0, windowHeight - topGap - bottom - SHEET_HANDLE_HEIGHT)
  const showVerse = data.verseHtml.length > 0
  let heading = data.verseNum
  if (data.reference) {
    heading = `${data.reference}:${data.verseNum}`
  }
  if (versionAbbreviation) {
    heading = `${heading} ${versionAbbreviation}`
  }
  const verseParagraphs = useMemo(() => parseNoteHtml(data.verseHtml), [data.verseHtml])
  const noteParagraphs = useMemo(() => data.notes.map(parseNoteHtml), [data.notes])
  // FootnoteData carries no direction, so a host that does not know it lets the text vote.
  const rtl = useMemo(() => {
    if (direction !== undefined) {
      return direction === 'rtl'
    }
    const paragraphs = verseParagraphs.length > 0 ? verseParagraphs : noteParagraphs.flat()
    return isRtlRuns(paragraphs.flat().map((run) => run.text))
  }, [direction, verseParagraphs, noteParagraphs])
  const foreground = tokens.foreground
  const muted = tokens.mutedForeground

  return (
    <ScrollView
      testID="footnote-content"
      nestedScrollEnabled
      style={{ maxHeight, direction: rtl ? 'rtl' : 'ltr' }}
      contentContainerStyle={styles.body}
    >
      {showVerse ? (
        <View>
          <Text
            allowFontScaling={false}
            testID="footnote-reference"
            style={[
              sansFace(tokens.fontFamily.sans, 700),
              tokens.typography.base,
              { color: foreground },
            ]}
          >
            {heading}
          </Text>
          <View testID="footnote-verse" style={styles.verse}>
            {verseParagraphs.map((runs, index) => (
              <ParagraphText
                key={index}
                runs={runs}
                faceFor={serifFaceFor}
                fontSize={VERSE_FONT_SIZE}
                lineHeight={lineHeight}
                color={foreground}
                muted={muted}
              />
            ))}
          </View>
        </View>
      ) : null}
      <View
        testID="footnote-notes"
        style={showVerse ? [styles.notes, { borderTopColor: tokens.border }] : undefined}
      >
        {data.notes.map((note, index) => {
          const marker = footnoteMarker(index)
          const label = `${marker}.`
          return (
            <View
              key={marker}
              testID={`footnote-note-${marker}`}
              style={[styles.note, { borderBottomColor: tokens.border }]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  sansFace(tokens.fontFamily.sans, 500),
                  { color: foreground, fontSize: LABEL_FONT_SIZE, lineHeight },
                ]}
              >
                {label}
              </Text>
              <View style={styles.noteCopy}>
                {(noteParagraphs[index] ?? []).map((runs, paragraphIndex) => (
                  <ParagraphText
                    key={paragraphIndex}
                    runs={runs}
                    faceFor={serifFaceFor}
                    fontSize={VERSE_FONT_SIZE}
                    lineHeight={lineHeight}
                    color={foreground}
                    muted={muted}
                  />
                ))}
              </View>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

function ParagraphText({
  runs,
  faceFor,
  fontSize,
  lineHeight,
  color,
  muted,
}: {
  runs: readonly NoteRun[]
  faceFor: SerifFaceFor
  fontSize: number
  lineHeight: number
  color: string
  muted: string
}): ReactNode {
  return (
    <Text
      allowFontScaling={false}
      style={[faceFor(400), { color, fontSize, lineHeight, overflow: 'visible' }]}
    >
      {runs.map((run, index) => {
        // The scripture character styles; Swift's sheet paints words of Jesus in the text color.
        const chars = resolveChars(run.classes)
        const face = faceFor(chars.weight ?? 400, slantOf(chars.italic))
        if (chars.raised) {
          return (
            <Superscript
              key={index}
              text={run.text}
              face={face}
              size={Math.round(fontSize * LABEL_SCALE)}
              color={muted}
            />
          )
        }
        const size = fontSize * (chars.scale ?? 1)
        return (
          <Text
            key={index}
            allowFontScaling={false}
            style={{ ...face, color, fontSize: size, lineHeight }}
          >
            {chars.smallCaps ? smallCaps(run.text, size) : run.text}
          </Text>
        )
      })}
    </Text>
  )
}

function Superscript({
  text,
  face,
  size,
  color,
}: {
  text: string
  face: ReturnType<SerifFaceFor>
  size: number
  color: string
}): ReactNode {
  // A nested Text shares the line, so a shift on it never leaves the baseline.
  // An inline view is positioned with its bottom on that baseline, and a shift on the view raises the letter.
  return (
    <View
      testID="footnote-superscript"
      style={{ transform: [{ translateY: -Math.round(size * SUP_RAISE_EM) }], overflow: 'visible' }}
    >
      <Text allowFontScaling={false} style={{ ...face, color, fontSize: size, lineHeight: size }}>
        {text}
      </Text>
    </View>
  )
}

function slantOf(italic: boolean): FontFace['style'] {
  return italic ? 'italic' : 'normal'
}

const styles = StyleSheet.create({
  // NativeSheet pads 8; Swift's sheet text sits 24 in.
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 16,
  },
  verse: {
    marginTop: 16,
  },
  notes: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noteCopy: {
    flex: 1,
  },
})

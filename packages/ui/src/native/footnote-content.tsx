import type { FootnoteData } from '@youversion/platform-react-ui'
import { useMemo, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { TextStyle } from 'react-native'

import { Text } from '../components/ui'
import { ThemeContext, useTokens } from '../hooks'
import {
  footnoteMarker,
  parseFootnoteHtml,
  type FootnoteParagraph,
  type FootnoteRun,
} from '../lib/footnote-html'
import { sansFace } from '../theme/fonts'
import { useSerifFace } from '../theme/use-fonts'

type FootnoteContentProps = {
  data: FootnoteData
  theme?: 'light' | 'dark'
  fontSize?: number
  scriptureDirection?: 'ltr' | 'rtl'
}

type FaceFor = (weight: FootnoteRun['weight']) => TextStyle

const VERSE_FONT_SIZE = 20
// Web sheet list is text-xs: 0.75rem, line-height 1 / 0.75.
const NOTE_FONT_SIZE = 12
const NOTE_LINE_HEIGHT = 16
// The web sheet sets -webkit-text-size-adjust: 100%, so it ignores the system text size.
// RN Text grows with that setting unless this is off. Extra Extra Large is 1.235×.
// sup { font-size: 75%; top: -0.5em } under [data-yv-sdk].
const SUP_SIZE_RATIO = 0.75
const SUP_RAISE_EM = 0.5

export default function FootnoteContent({
  data,
  theme = 'light',
  fontSize,
  scriptureDirection,
}: FootnoteContentProps): ReactNode {
  return (
    <ThemeContext.Provider value={theme}>
      <FootnoteBody data={data} fontSize={fontSize} rtl={scriptureDirection === 'rtl'} />
    </ThemeContext.Provider>
  )
}

function FootnoteBody({
  data,
  fontSize,
  rtl,
}: {
  data: FootnoteData
  fontSize: number | undefined
  rtl: boolean
}): ReactNode {
  const tokens = useTokens()
  const serifFaceFor = useSerifFace()
  const showVerse = data.verseHtml.length > 0
  let heading = data.verseNum
  if (data.reference) {
    heading = `${data.reference}:${data.verseNum}`
  }
  const verseSize = fontSize ?? VERSE_FONT_SIZE
  const verseParagraphs = useMemo(() => parseFootnoteHtml(data.verseHtml), [data.verseHtml])
  const noteParagraphs = useMemo(() => data.notes.map(parseFootnoteHtml), [data.notes])
  const foreground = tokens.foreground
  const muted = tokens.mutedForeground
  const sans = tokens.fontFamily.sans
  const sansFor: FaceFor = (weight) => sansFace(sans, weight)

  return (
    <View testID="footnote-content" style={[styles.body, { direction: rtl ? 'rtl' : 'ltr' }]}>
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
            {verseParagraphs.map((paragraph, index) => (
              <ParagraphText
                key={index}
                paragraph={paragraph}
                faceFor={serifFaceFor}
                fontSize={verseSize}
                lineHeight={lineHeightFor(verseSize)}
                color={foreground}
                muted={muted}
              />
            ))}
          </View>
        </View>
      ) : null}
      <View testID="footnote-notes" style={styles.notes}>
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
                  sansFace(sans, 400),
                  { color: foreground, fontSize: NOTE_FONT_SIZE, lineHeight: NOTE_LINE_HEIGHT },
                ]}
              >
                {label}
              </Text>
              <View style={styles.noteCopy}>
                {(noteParagraphs[index] ?? []).map((paragraph, paragraphIndex) => (
                  <ParagraphText
                    key={paragraphIndex}
                    paragraph={paragraph}
                    faceFor={sansFor}
                    fontSize={NOTE_FONT_SIZE}
                    lineHeight={NOTE_LINE_HEIGHT}
                    color={foreground}
                    muted={muted}
                  />
                ))}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function ParagraphText({
  paragraph,
  faceFor,
  fontSize,
  lineHeight,
  color,
  muted,
}: {
  paragraph: FootnoteParagraph
  faceFor: FaceFor
  fontSize: number
  lineHeight: number
  color: string
  muted: string
}): ReactNode {
  const face = faceFor(400)
  return (
    <Text
      allowFontScaling={false}
      style={[face, { color, fontSize, lineHeight, overflow: 'visible' }]}
    >
      {paragraph.runs.map((run, index) => {
        if (run.sup) {
          return (
            <Superscript
              key={index}
              run={run}
              faceFor={faceFor}
              fontSize={fontSize}
              color={muted}
            />
          )
        }
        return (
          <Text
            key={index}
            allowFontScaling={false}
            style={{ ...faceFor(run.weight), color, fontSize, lineHeight }}
          >
            {run.text}
          </Text>
        )
      })}
    </Text>
  )
}

function Superscript({
  run,
  faceFor,
  fontSize,
  color,
}: {
  run: FootnoteRun
  faceFor: FaceFor
  fontSize: number
  color: string
}): ReactNode {
  const supSize = Math.max(1, Math.round(fontSize * SUP_SIZE_RATIO))
  const raise = Math.round(supSize * SUP_RAISE_EM)
  const face = faceFor(run.weight)
  // A nested Text shares the line, so a shift on it never leaves the baseline.
  // An inline view is positioned with its bottom on that baseline, and a shift on the view raises the letter.
  return (
    <View
      testID="footnote-superscript"
      style={{ transform: [{ translateY: -raise }], overflow: 'visible' }}
    >
      <Text
        allowFontScaling={false}
        style={{ ...face, color, fontSize: supSize, lineHeight: supSize }}
      >
        {run.text}
      </Text>
    </View>
  )
}

function lineHeightFor(fontSize: number): number {
  // [data-yv-sdk] sets line-height: 1.5, and the verse inherits it.
  return Math.round(fontSize * 1.5)
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  verse: {
    marginTop: 8,
  },
  notes: {
    gap: 4,
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noteCopy: {
    flex: 1,
  },
})

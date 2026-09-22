import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { TextStyle } from 'react-native'

import { Text } from '../components/ui'
import type { FootnoteContentDOMProps } from '../dom/footnote-content'
import { ThemeContext, useTokens } from '../hooks'
import {
  footnoteMarker,
  parseFootnoteHtml,
  type FootnoteParagraph,
  type FootnoteRun,
} from '../lib/footnote-html'
import { sansFace, serifFace } from '../theme/fonts'

const VERSE_FONT_SIZE = 20
// Web sheet list is text-xs: 0.75rem, line-height 1 / 0.75.
const NOTE_FONT_SIZE = 12
const NOTE_LINE_HEIGHT = 16
// sup { font-size: 75%; top: -0.5em } under [data-yv-sdk].
const SUP_SIZE_RATIO = 0.75
const SUP_RAISE_EM = 0.5

export default function FootnoteContent({
  data,
  theme = 'light',
  fontSize,
}: FootnoteContentDOMProps): ReactNode {
  return (
    <ThemeContext.Provider value={theme}>
      <FootnoteBody data={data} fontSize={fontSize} />
    </ThemeContext.Provider>
  )
}

function FootnoteBody({
  data,
  fontSize,
}: {
  data: FootnoteContentDOMProps['data']
  fontSize: number | undefined
}): ReactNode {
  const tokens = useTokens()
  const showVerse = data.verseHtml.length > 0
  let heading = data.verseNum
  if (data.reference) {
    heading = `${data.reference}:${data.verseNum}`
  }
  const verseSize = fontSize ?? VERSE_FONT_SIZE
  const verseParagraphs = parseFootnoteHtml(data.verseHtml)
  const foreground = tokens.foreground
  const muted = tokens.mutedForeground
  const serif = tokens.fontFamily.serif
  const sans = tokens.fontFamily.sans

  return (
    <View testID="footnote-content" style={styles.body}>
      {showVerse ? (
        <View>
          <Text
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
                family={serif}
                fontSize={verseSize}
                lineHeight={lineHeightFor(verseSize)}
                color={foreground}
                muted={muted}
                serif
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
                style={[
                  sansFace(sans, 400),
                  { color: foreground, fontSize: NOTE_FONT_SIZE, lineHeight: NOTE_LINE_HEIGHT },
                ]}
              >
                {label}
              </Text>
              <View style={styles.noteCopy}>
                {parseFootnoteHtml(note).map((paragraph, paragraphIndex) => (
                  <ParagraphText
                    key={paragraphIndex}
                    paragraph={paragraph}
                    family={sans}
                    fontSize={NOTE_FONT_SIZE}
                    lineHeight={NOTE_LINE_HEIGHT}
                    color={foreground}
                    muted={muted}
                    serif={false}
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
  family,
  fontSize,
  lineHeight,
  color,
  muted,
  serif,
}: {
  paragraph: FootnoteParagraph
  family: string
  fontSize: number
  lineHeight: number
  color: string
  muted: string
  serif: boolean
}): ReactNode {
  const face = serif ? serifFace(family, 400) : sansFace(family, 400)
  return (
    <Text style={[face, { color, fontSize, lineHeight }]}>
      {paragraph.runs.map((run, index) => (
        <Text key={index} style={runStyle(run, family, fontSize, lineHeight, color, muted, serif)}>
          {run.text}
        </Text>
      ))}
    </Text>
  )
}

function runStyle(
  run: FootnoteRun,
  family: string,
  fontSize: number,
  lineHeight: number,
  color: string,
  muted: string,
  serif: boolean,
): TextStyle {
  let runColor = color
  let runSize = fontSize
  let shift = 0
  if (run.sup) {
    runColor = muted
    runSize = Math.max(1, Math.round(fontSize * SUP_SIZE_RATIO))
    // RN Text has no vertical-align. Half the superscript size matches CSS top: -0.5em.
    shift = -Math.round(runSize * SUP_RAISE_EM)
  }
  const weight = run.weight
  const face = serif ? serifFace(family, weight) : sansFace(family, weight)
  const style: TextStyle = {
    ...face,
    color: runColor,
    fontSize: runSize,
    lineHeight,
  }
  if (shift !== 0) {
    style.transform = [{ translateY: shift }]
  }
  return style
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

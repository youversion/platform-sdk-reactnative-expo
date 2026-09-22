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
  const wj = tokens.wj
  const serif = tokens.fontFamily.serif

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
                wj={wj}
              />
            ))}
          </View>
        </View>
      ) : null}
      <View testID="footnote-notes">
        {data.notes.map((note, index) => {
          const marker = footnoteMarker(index)
          const label = `${marker}.`
          return (
            <View
              key={marker}
              testID={`footnote-note-${marker}`}
              style={[styles.note, { borderBottomColor: tokens.border }]}
            >
              <Text variant="muted">{label}</Text>
              <View style={styles.noteCopy}>
                {parseFootnoteHtml(note).map((paragraph, paragraphIndex) => (
                  <ParagraphText
                    key={paragraphIndex}
                    paragraph={paragraph}
                    family={serif}
                    fontSize={tokens.typography.sm.fontSize}
                    lineHeight={tokens.typography.sm.lineHeight}
                    color={foreground}
                    muted={muted}
                    wj={wj}
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
  wj,
}: {
  paragraph: FootnoteParagraph
  family: string
  fontSize: number
  lineHeight: number
  color: string
  muted: string
  wj: string
}): ReactNode {
  return (
    <Text style={[serifFace(family, 400), { color, fontSize, lineHeight }]}>
      {paragraph.runs.map((run, index) => (
        <Text key={index} style={runStyle(run, family, fontSize, color, muted, wj)}>
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
  color: string,
  muted: string,
  wj: string,
): TextStyle {
  let faceStyle: 'italic' | 'normal' = 'normal'
  if (run.italic) {
    faceStyle = 'italic'
  }
  let runColor = color
  if (run.wj) {
    runColor = wj
  }
  if (run.sup) {
    runColor = muted
  }
  let runSize = fontSize
  if (run.sup) {
    runSize = Math.max(1, Math.round(fontSize * 0.7))
  }
  const style: TextStyle = {
    ...serifFace(family, run.weight, faceStyle),
    color: runColor,
    fontSize: runSize,
  }
  if (run.smallCaps) {
    style.fontVariant = ['small-caps']
  }
  return style
}

function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * 1.4)
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 12,
  },
  verse: {
    marginTop: 8,
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

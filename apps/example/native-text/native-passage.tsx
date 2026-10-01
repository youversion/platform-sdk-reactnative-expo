import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { memo, useState, type ReactNode } from 'react'
import { Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import type { Block, Inline } from './parse-passage'
import { faceName, LABEL_SCALE, resolveBlock, resolveChars } from './scripture-styles'

// CSS raises the label 0.2em of its own size; tune per platform on device.
const LABEL_RISE = Platform.select({ android: -0.13, default: -0.2 })
const HIGHLIGHT = '#f19c3333'

export type LabelMode = 'raised' | 'flat'

type Props = {
  blocks: Block[]
  fontSize: number
  serifFamily: string
  rtl: boolean
  labelMode: LabelMode
  onLayout: (event: LayoutChangeEvent) => void
  onFootnotePress: (html: string) => void
}

export const NativePassage = memo(function NativePassage({
  blocks,
  fontSize,
  serifFamily,
  rtl,
  labelMode,
  onLayout,
  onFootnotePress,
}: Props): ReactNode {
  const tokens = useTokens()
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [highlighted, setHighlighted] = useState<ReadonlySet<number>>(new Set())
  const toggle = (set: ReadonlySet<number>, verse: number): Set<number> => {
    const next = new Set(set)
    if (!next.delete(verse)) {
      next.add(verse)
    }
    return next
  }

  const renderInline = (
    inline: Inline,
    key: number,
    blockFace: { weight: 400 | 500; italic: boolean; size: number },
  ): ReactNode => {
    if (inline.kind === 'label') {
      const labelStyle = {
        fontFamily: 'Inter',
        fontSize: fontSize * LABEL_SCALE,
        color: tokens.mutedForeground,
      }
      if (labelMode === 'flat') {
        return (
          <Text key={key} style={labelStyle}>
            {`${inline.text} `}
          </Text>
        )
      }
      return (
        // End padding, not a trailing space: under RTL the space lands on the far side.
        <View
          key={key}
          style={{ paddingEnd: fontSize * 0.2, transform: [{ translateY: fontSize * LABEL_RISE }] }}
        >
          <Text style={[labelStyle, { lineHeight: fontSize * LABEL_SCALE * 1.2 }]}>{inline.text}</Text>
        </View>
      )
    }
    if (inline.kind === 'note') {
      // Matched by eye to the DOM reader's footnote icon.
      const size = fontSize * 1.2
      return (
        <Pressable
          key={key}
          hitSlop={8}
          onPress={() => onFootnotePress(inline.html)}
          style={{ paddingHorizontal: fontSize * 0.2 }}
        >
          <Svg width={size} height={size} viewBox="0 0 20 20">
            <Path d={NOTE_ICON} fill={tokens.mutedForeground} fillRule="evenodd" />
          </Svg>
        </Pressable>
      )
    }
    const chars = resolveChars(inline.classes)
    const weight = chars.bold ? 700 : chars.medium ? 500 : blockFace.weight
    return (
      <Text
        key={key}
        style={{
          fontFamily: faceName(serifFamily, weight, chars.italic || blockFace.italic),
          color: chars.wordsOfJesus ? tokens.wj : undefined,
        }}
      >
        {chars.smallCaps ? smallCaps(inline.text, blockFace.size) : inline.text}
      </Text>
    )
  }

  return (
    <View onLayout={onLayout} style={{ direction: rtl ? 'rtl' : 'ltr' }}>
      {blocks.map((block, blockIndex) => {
        const resolved = resolveBlock(block.classes, fontSize, rtl)
        // CSS collapses adjacent vertical margins to the larger of the two.
        const previous = blockIndex > 0 ? resolveBlock(blocks[blockIndex - 1]?.classes ?? [], fontSize, rtl) : null
        const marginTop = Math.max(0, Number(resolved.style.marginTop ?? 0) - Number(previous?.style.marginBottom ?? 0))
        const face = { weight: resolved.weight, italic: resolved.italic, size: resolved.style.fontSize ?? fontSize }
        return (
          <Text
            key={blockIndex}
            style={[
              resolved.style,
              {
                marginTop,
                color: tokens.foreground,
                fontFamily: faceName(serifFamily, resolved.weight, resolved.italic),
              },
            ]}
          >
            {/* iOS reads paragraph style (lineHeight) from the first character; an
                inline View there drops it for the whole block, so lead with text. */}
            {'\u200b'}
            {resolved.indentFirst > 0 && <View style={{ width: resolved.indentFirst }} />}
            {block.segments.map((segment, segmentIndex) => {
              const verse = segment.verse
              const isSelected = verse !== null && selected.has(verse)
              return (
                <Text
                  key={segmentIndex}
                  onPress={verse === null ? undefined : () => setSelected((s) => toggle(s, verse))}
                  onLongPress={verse === null ? undefined : () => setHighlighted((s) => toggle(s, verse))}
                  style={[
                    verse !== null && highlighted.has(verse) && { backgroundColor: HIGHLIGHT },
                    isSelected && {
                      textDecorationLine: 'underline',
                      textDecorationColor: tokens.foreground,
                    },
                  ]}
                >
                  {segment.inlines.map((inline, i) => renderInline(inline, i, face))}
                </Text>
              )
            })}
          </Text>
        )
      })}
    </View>
  )
})

// Neither Untitled Serif nor Source Serif answers `fontVariant: small-caps` on
// iOS, so synthesize it the way browsers do: lowercase runs uppercased at ~0.75.
function smallCaps(text: string, size: number): ReactNode[] {
  return Array.from(text.matchAll(/(\p{Ll}+)|([^\p{Ll}]+)/gu), (match, i) =>
    match[1] === undefined ? (
      match[0]
    ) : (
      <Text key={i} style={{ fontSize: size * 0.75 }}>
        {match[1].toUpperCase()}
      </Text>
    ),
  )
}

// Web SDK footnote glyph (20×20 note bubble), as in Brenden's spike.
const NOTE_ICON =
  'M5.00033 4.16667C4.09255 4.16667 3.33366 4.92556 3.33366 5.83333V12.5C3.33366 13.4078 4.09255 14.1667 5.00033 14.1667H6.66699C7.12723 14.1667 7.50033 14.5398 7.50033 15V16.0282L10.4049 14.2854C10.5344 14.2077 10.6826 14.1667 10.8337 14.1667H15.0003C15.9081 14.1667 16.667 13.4078 16.667 12.5V5.83333C16.667 4.92556 15.9081 4.16667 15.0003 4.16667H5.00033ZM5.00033 2.5H15.0003C16.8159 2.5 18.3337 4.01778 18.3337 5.83333V12.5C18.3337 14.3156 16.8159 15.8333 15.0003 15.8333H11.0645L7.09574 18.2146C6.55059 18.5417 5.83366 18.1357 5.83366 17.5V15.8333H5.00033C3.18477 15.8333 1.66699 14.3156 1.66699 12.5V5.83333C1.66699 4.01778 3.18477 2.5 5.00033 2.5ZM5.83366 7.5C5.83366 7.03976 6.20675 6.66667 6.66699 6.66667H13.3337C13.7939 6.66667 14.167 7.03976 14.167 7.5C14.167 7.96024 13.7939 8.33333 13.3337 8.33333H6.66699C6.20675 8.33333 5.83366 7.96024 5.83366 7.5ZM5.83366 10.8333C5.83366 10.3731 6.20675 10 6.66699 10H11.667C12.1272 10 12.5003 10.3731 12.5003 10.8333C12.5003 11.2936 12.1272 11.6667 11.667 11.6667H6.66699C6.20675 11.6667 5.83366 11.2936 5.83366 10.8333Z'

import { memo, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  Text as RNText,
  View,
  type LayoutChangeEvent,
  type Text as RNTextInstance,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { withAlpha } from '../../lib/color'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'
import type { HighlightPaint } from './highlight-colors'
import type { Block, Inline } from './parse-passage'
import {
  blockMarginBottom,
  collapsedMarginTop,
  LABEL_SCALE,
  resolveBlock,
  resolveChars,
  type ResolvedBlock,
} from './styles'

type Weight = 400 | 500 | 700

/** Everything a block needs that does not change per verse. One object per settings change. */
export type PassageLook = {
  fontSize: number
  lineSpacing: number
  rtl: boolean
  /** Registered face for a reader-font weight and slant. */
  face: (weight: Weight, italic: boolean) => string
  labelFace: string
  /** `#rrggbb`, so alphas can be applied. */
  ink: string
  wj: string
  underline: string
}

export type VerseFocusDim = ReadonlySet<number> | null

type PassageProps = {
  blocks: readonly Block[]
  look: PassageLook
  selected: ReadonlySet<number>
  paint: ReadonlyMap<number, HighlightPaint>
  /** Verses kept bright while a focus dims the rest; `null` dims nothing. */
  focus: VerseFocusDim
  onVersePress: (verse: number) => void
  onNotePress: (verse: number | null, html: string) => void
  onBlockLayout: (index: number, y: number, height: number) => void
  onBlockRef: (index: number, node: RNTextInstance | null) => void
}

// CSS raises the label 0.2em of the reader size; RN has no baseline offset, so nudge the inline view.
const LABEL_RISE = Platform.select({ android: -0.13, default: -0.2 })
// iOS centres the glyphs in an enlarged line box but not the inline views, so
// LABEL_RISE (tuned at the default spacing) drifts as spacing moves off it.
const ATTACHMENT_DRIFT = Platform.OS === 'ios' ? 0.5 : 0
const LABEL_ALPHA = 0.7
const NOTE_ALPHA = 0.5
const DIM_ALPHA = 0.35
// Zero-width space: an invisible first character that carries the block's paragraph style.
const PARAGRAPH_ANCHOR = '\u200b'

export function Passage({ blocks, ...rest }: PassageProps): ReactNode {
  const resolved = blocks.map((block) => resolveBlock(block.classes, rest.look.fontSize))
  return (
    <View style={{ direction: rest.look.rtl ? 'rtl' : 'ltr' }}>
      {blocks.map((block, index) => (
        <BlockView
          key={`${index}:${blockStateKey(block, rest)}`}
          index={index}
          block={block}
          rule={resolved[index] ?? resolveBlock([], rest.look.fontSize)}
          previous={index > 0 ? (resolved[index - 1] ?? null) : null}
          {...rest}
        />
      ))}
    </View>
  )
}

type BlockViewProps = Omit<PassageProps, 'blocks'> & {
  index: number
  block: Block
  rule: ResolvedBlock
  previous: ResolvedBlock | null
}

const BlockView = memo(function BlockView({
  index,
  block,
  rule,
  previous,
  look,
  selected,
  paint,
  focus,
  onVersePress,
  onNotePress,
  onBlockLayout,
  onBlockRef,
}: BlockViewProps): ReactNode {
  const { fontSize } = look
  const drift = -ATTACHMENT_DRIFT * rule.size * (look.lineSpacing - READER_LINE_SPACING.DEFAULT)
  const blockDimmed = focus !== null && block.heading
  const color = (hex: string, alpha: number, dimmed: boolean): string => {
    const value = dimmed ? alpha * DIM_ALPHA : alpha
    return value === 1 ? hex : withAlpha(hex, value)
  }

  const renderInline = (
    inline: Inline,
    key: number,
    verse: number | null,
    dimmed: boolean,
  ): ReactNode => {
    const fill = verse === null ? undefined : paint.get(verse)
    const overInk = fill?.text ?? null
    if (inline.kind === 'label') {
      return (
        // End padding, not a trailing space: under RTL the space lands on the far side.
        <Pressable
          key={key}
          disabled={verse === null}
          onPress={verse === null ? undefined : () => onVersePress(verse)}
          style={{
            paddingEnd: fontSize * 0.25,
            transform: [{ translateY: fontSize * LABEL_RISE + drift }],
            backgroundColor: background(fill, dimmed),
          }}
        >
          <RNText
            allowFontScaling={false}
            style={{
              fontFamily: look.labelFace,
              fontSize: fontSize * LABEL_SCALE,
              lineHeight: fontSize * LABEL_SCALE * 1.2,
              color: color(overInk ?? look.ink, overInk === null ? LABEL_ALPHA : 1, dimmed),
            }}
          >
            {inline.text}
          </RNText>
        </Pressable>
      )
    }
    if (inline.kind === 'note') {
      const size = fontSize * 1.2
      return (
        <Pressable
          key={key}
          hitSlop={8}
          accessibilityRole="button"
          onPress={() => onNotePress(verse, inline.html)}
          style={{
            paddingHorizontal: fontSize * 0.2,
            transform: [{ translateY: drift }],
            backgroundColor: background(fill, dimmed),
          }}
        >
          <Svg width={size} height={size} viewBox="0 0 20 20">
            <Path
              d={NOTE_ICON}
              fill={color(overInk ?? look.ink, NOTE_ALPHA, dimmed)}
              fillRule="evenodd"
            />
          </Svg>
        </Pressable>
      )
    }
    const chars = resolveChars(inline.classes)
    const weight = chars.weight ?? rule.weight
    const size = chars.scale === null ? rule.size : rule.size * chars.scale
    const wj = chars.wordsOfJesus && overInk === null ? color(look.wj, 1, dimmed) : undefined
    return (
      <RNText
        key={key}
        style={{
          fontFamily: look.face(weight, chars.italic || rule.italic),
          color: wj,
          fontSize: chars.scale === null ? undefined : size,
        }}
      >
        {chars.smallCaps || rule.smallCaps ? smallCaps(inline.text, size) : inline.text}
      </RNText>
    )
  }

  const onLayout = (event: LayoutChangeEvent): void => {
    onBlockLayout(index, event.nativeEvent.layout.y, event.nativeEvent.layout.height)
  }

  return (
    <RNText
      ref={(node) => onBlockRef(index, node)}
      allowFontScaling={false}
      onLayout={onLayout}
      style={{
        fontSize: rule.size,
        lineHeight: rule.size * look.lineSpacing,
        color: color(look.ink, 1, blockDimmed),
        fontFamily: look.face(rule.weight, rule.italic),
        textAlign: rule.align,
        writingDirection: look.rtl ? 'rtl' : 'ltr',
        paddingStart: rule.headIndent,
        marginTop: collapsedMarginTop(rule, previous, fontSize),
        marginBottom: blockMarginBottom(rule, fontSize, look.lineSpacing),
      }}
    >
      {/* iOS reads paragraph style (lineHeight) from the first character; an
          inline View there drops it for the whole block, so lead with text. */}
      {PARAGRAPH_ANCHOR}
      {rule.firstIndent > 0 && <View style={{ width: rule.firstIndent }} />}
      {block.segments.map((segment, segmentIndex) => {
        const verse = segment.verse
        const fill = verse === null ? undefined : paint.get(verse)
        const dimmed = blockDimmed || (focus !== null && (verse === null || !focus.has(verse)))
        const isSelected = verse !== null && selected.has(verse)
        const ink = fill?.text ?? look.ink
        return (
          <RNText
            key={segmentIndex}
            suppressHighlighting
            onPress={verse === null ? undefined : () => onVersePress(verse)}
            style={{
              color: color(ink, 1, dimmed),
              backgroundColor: background(fill, dimmed),
              textDecorationLine: isSelected ? 'underline' : 'none',
              textDecorationColor: look.underline,
            }}
          >
            {segment.inlines.map((inline, i) => renderInline(inline, i, verse, dimmed))}
          </RNText>
        )
      })}
    </RNText>
  )
}, sameBlockState)

function background(fill: HighlightPaint | undefined, dimmed: boolean): string | undefined {
  if (fill === undefined) {
    return undefined
  }
  return dimmed ? withAlpha(fill.background, DIM_ALPHA) : fill.background
}

// Fabric iOS misplaces inline-View attachments (labels, note icons) when a
// paragraph re-renders in place; a remount lays them out fresh.
function blockStateKey(block: Block, state: Omit<PassageProps, 'blocks'>): string {
  const { look } = state
  const focused = state.focus === null ? 'n' : 'f'
  const looks = `${look.fontSize}|${look.lineSpacing}|${look.face(400, false)}|${look.ink}|`
  return (
    looks +
    focused +
    block.verses
      .map(
        (verse) =>
          `${state.selected.has(verse) ? 's' : ''}${state.paint.get(verse)?.background ?? ''}${state.focus?.has(verse) ? 'f' : ''}`,
      )
      .join(',')
  )
}

/** Skips a block when nothing about its own verses changed, so a tap repaints one paragraph. */
function sameBlockState(a: BlockViewProps, b: BlockViewProps): boolean {
  if (
    a.block !== b.block ||
    a.look !== b.look ||
    a.rule.top !== b.rule.top ||
    a.previous?.bottom !== b.previous?.bottom ||
    a.onVersePress !== b.onVersePress ||
    a.onNotePress !== b.onNotePress ||
    a.onBlockLayout !== b.onBlockLayout ||
    a.onBlockRef !== b.onBlockRef ||
    (a.focus === null) !== (b.focus === null)
  ) {
    return false
  }
  return a.block.verses.every(
    (verse) =>
      a.selected.has(verse) === b.selected.has(verse) &&
      a.paint.get(verse) === b.paint.get(verse) &&
      (a.focus?.has(verse) ?? false) === (b.focus?.has(verse) ?? false),
  )
}

// Neither Untitled Serif nor Source Serif answers `fontVariant: small-caps` on
// iOS, so synthesize it the way browsers do: lowercase runs uppercased at ~0.75.
function smallCaps(text: string, size: number): ReactNode[] {
  return Array.from(text.matchAll(/(\p{Ll}+)|([^\p{Ll}]+)/gu), (match, i) =>
    match[1] === undefined ? (
      match[0]
    ) : (
      <RNText key={i} style={{ fontSize: size * 0.75 }}>
        {match[1].toUpperCase()}
      </RNText>
    ),
  )
}

// Web SDK footnote glyph (20×20 note bubble).
const NOTE_ICON =
  'M5.00033 4.16667C4.09255 4.16667 3.33366 4.92556 3.33366 5.83333V12.5C3.33366 13.4078 4.09255 14.1667 5.00033 14.1667H6.66699C7.12723 14.1667 7.50033 14.5398 7.50033 15V16.0282L10.4049 14.2854C10.5344 14.2077 10.6826 14.1667 10.8337 14.1667H15.0003C15.9081 14.1667 16.667 13.4078 16.667 12.5V5.83333C16.667 4.92556 15.9081 4.16667 15.0003 4.16667H5.00033ZM5.00033 2.5H15.0003C16.8159 2.5 18.3337 4.01778 18.3337 5.83333V12.5C18.3337 14.3156 16.8159 15.8333 15.0003 15.8333H11.0645L7.09574 18.2146C6.55059 18.5417 5.83366 18.1357 5.83366 17.5V15.8333H5.00033C3.18477 15.8333 1.66699 14.3156 1.66699 12.5V5.83333C1.66699 4.01778 3.18477 2.5 5.00033 2.5ZM5.83366 7.5C5.83366 7.03976 6.20675 6.66667 6.66699 6.66667H13.3337C13.7939 6.66667 14.167 7.03976 14.167 7.5C14.167 7.96024 13.7939 8.33333 13.3337 8.33333H6.66699C6.20675 8.33333 5.83366 7.96024 5.83366 7.5ZM5.83366 10.8333C5.83366 10.3731 6.20675 10 6.66699 10H11.667C12.1272 10 12.5003 10.3731 12.5003 10.8333C12.5003 11.2936 12.1272 11.6667 11.667 11.6667H6.66699C6.20675 11.6667 5.83366 11.2936 5.83366 10.8333Z'

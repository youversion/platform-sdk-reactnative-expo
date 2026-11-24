import { Fragment, memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  PixelRatio,
  Platform,
  Pressable,
  Text as RNText,
  View,
  type LayoutChangeEvent,
  type TextLayoutEvent,
  type Text as RNTextInstance,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { useSdkTranslation } from '../../i18n/use-sdk-translation'
import type { VerseIndicatorStyle } from '../../types/verse-hook-types'
import { scaleAlpha, withAlpha } from '../../lib/color'
import { palette } from '../../theme/palette'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'
import { directionMark } from './direction-mark'
import type { HighlightPaint } from './highlight-colors'
import { leftEdge } from './left-edge'
import type { Block, Inline } from './parse-passage'
import { passageRuns, type TableRow } from './table'
import { applySmallCaps, verseLineBoxes, type LineBox } from './verse-line'
import {
  blockMarginBottom,
  collapsedMarginTop,
  LABEL_SCALE,
  lineLeading,
  lineMultiple,
  resolveBlock,
  resolveChars,
  type ResolvedBlock,
} from './styles'

type Weight = 400 | 500 | 700

/** Everything a block needs that does not change per verse. One object per settings change. */
export type PassageLook = {
  fontSize: number
  /** Line box as a multiple of `fontSize`. */
  lineMultiple: number
  rtl: boolean
  /** Text style naming the reader-font face for a weight and slant. */
  face: (weight: Weight, italic: boolean) => TextStyle
  labelFace: TextStyle
  /** `#rrggbb`, so alphas can be applied. */
  ink: string
  /** Verse number color. Figma Text/Muted when the host does not override ink. */
  label: string
  wj: string
  underline: string
  background: string
}

export type VerseFocusDim = ReadonlySet<number> | null

type PassageProps = {
  blocks: readonly Block[]
  look: PassageLook
  selected: ReadonlySet<number>
  paint: ReadonlyMap<number, HighlightPaint>
  /** Verses kept bright while a focus dims the rest; `null` dims nothing. */
  focus: VerseFocusDim
  /** Absent for read-only text: verses take no taps. */
  onVersePress?: (verse: number) => void
  onNotePress: (verse: number | null, html: string) => void
  /** Verses whose number draws as a marker. Absent is the plain path. */
  indicators?: ReadonlyMap<number, VerseIndicatorStyle>
  /** A marker's own tap. Never also calls `onVersePress`. */
  onIndicatorPress?: (verse: number) => void
  /** Reader-only. Scroll and focus measure blocks. */
  onBlockLayout?: (index: number, y: number, height: number) => void
  onBlockRef?: (index: number, node: RNTextInstance | null) => void
  /** Verses whose line positions the reader needs before it can scroll. */
  probeVerses?: readonly number[] | null
  onVerseLines?: (index: number, boxes: ReadonlyMap<number, LineBox> | null) => void
}

// Swift raises the label 0.2em so its top meets the cap height; RN has no baseline
// offset and seats the inline view lower, so the nudge is larger (measured).
const LABEL_RISE = Platform.select({ android: -0.25, default: -0.32 })
// iOS centres the glyphs in an enlarged line box but not the inline views, so
// LABEL_RISE (tuned at the default spacing) drifts as spacing moves off it.
const ATTACHMENT_DRIFT = Platform.OS === 'ios' ? 0.5 : 0
// Swift draws its untinted asset (gray20) in a square the height of an 0.8em run,
// raised a quarter of that, in every scheme and over highlights. Android seats inline
// views higher, so it rises less to sit the same against the glyphs (measured).
// Kept inside the highlight band, so the bubble does not cross the top of the paint.
const NOTE_SCALE = 1
const NOTE_RISE = Platform.select({ android: 0.08, default: 0.28 })
const NOTE_LEAD = 0
const NOTE_TRAIL = 0.08
const DIM_ALPHA = 0.35
// An invisible first character that carries the block's paragraph style. A word joiner,
// not a zero-width space, so a cell too narrow for its first word cannot break after it.
const PARAGRAPH_ANCHOR = '\u2060'
// Android reads colour 0 ('transparent') as unset, so ghost text would fall back to
// black; alpha 0 with a non-zero channel stays invisible on both platforms.
const TRANSPARENT = withAlpha(palette.white, 0)
// iOS seats inline views a fixed ~2.8pt above the line box at every size and spacing
// (measured); likely TextKit's Helvetica 12 fallback descender for the font-less attachment.
const BOX_SHIFT = 2.8
// Android grows a line's ascent to fit an inline view and takes the excess from its
// descent, which drops the baseline and clips a last line's descenders; capped at the
// highlight band's ascent, the box stays inside the text's own ascent.
const CAP_BOX = Platform.OS === 'android'
// Underline top, in em below the baseline, and its thickness in points.
const UNDERLINE_OFFSET = 0.37
const UNDERLINE_THICKNESS = 1
// How far a highlight runs past each end of its line. 0.1em fits in a verse's
// trailing space, so the paint stops short of the next verse number.
// Nested text takes no padding, so the backdrop shifts by this. The reader gives
// the column this much extra width and the paragraph pads the words back.
const HIGHLIGHT_PAD = 0.1

export function highlightEndRoom(size: number): number {
  return HIGHLIGHT_PAD * size
}
const BAND_ASCENT = 0.98
const BAND_DESCENT = 0.26
// Figma verse-marker chip (Utility/Info @ 50%, 13×22) uses a 2pt corner. Vertical pad
// grows the painted chip; the label transform drops by the same amount so the extra
// height falls into the highlight band instead of above it.
const INDICATOR_RADIUS = 2
const INDICATOR_PAD_Y = 3
// iOS counts a wrapped line's trailing spaces in its width (measured); Android is unchecked.
const TRIM_TRAILING_SPACE = Platform.OS === 'ios'
const NBSP = '\u00a0'
// An inline view is a break opportunity on both sides; this keeps a verse label on the
// line of its first word, and a note marker on the line of its last, as Swift does.
const WORD_JOINER = '\u2060'

// The real text, the selection underline, and the highlight backdrop. Bright and
// dimmed highlights paint in separate backdrops so the dimmed one can fade as a group.
type Layer = 'text' | 'underline' | 'fill' | 'dimFill'

export function Passage({ blocks, ...rest }: PassageProps): ReactNode {
  const { fontSize } = rest.look
  // Stable across taps, so the memoized blocks keep their `rule` and `previous` props.
  const resolved = useMemo(
    () => blocks.map((block) => resolveBlock(block.classes, fontSize)),
    [blocks, fontSize],
  )
  const runs = useMemo(() => passageRuns(blocks), [blocks])
  const plain = useMemo(() => resolveBlock([], fontSize), [fontSize])
  return (
    <View style={{ direction: rest.look.rtl ? 'rtl' : 'ltr' }}>
      {runs.map((run, at) => {
        if (run.kind === 'table') {
          return (
            <PassageTable
              key={`t${run.id}`}
              rows={run.rows}
              blocks={blocks}
              resolved={resolved}
              plain={plain}
              {...rest}
            />
          )
        }
        const { index } = run
        const block = blocks[index]
        if (block === undefined) {
          return null
        }
        // A table has no margins of its own; the paragraph after it collapses against none.
        const before = runs[at - 1]
        const previous =
          before === undefined
            ? null
            : before.kind === 'table'
              ? plain
              : (resolved[index - 1] ?? null)
        return (
          <BlockView
            key={`${index}:${blockStateKey(block, rest)}`}
            index={index}
            block={block}
            rule={resolved[index] ?? plain}
            previous={previous}
            {...rest}
          />
        )
      })}
    </View>
  )
}

type TableLayout = {
  table: number | null
  rows: Map<number, number>
  cells: Map<number, { row: number; y: number; height: number }>
  report: PassageProps['onBlockLayout']
}

// Swift's table grid: `.padding()`, 15pt between columns, 10pt between text rows.
const TABLE_PAD = 16
const TABLE_COLUMN_GAP = 15
const TABLE_ROW_GAP = 10

/**
 * Widths for columns 1…n-1, shared out like Swift's Grid: the last column keeps its
 * natural width, each middle column takes at most an even share of what is left (the
 * narrowest first), and column 0 gets the rest. Null until every column is measured.
 */
export function tableColumnWidths(
  room: number,
  natural: readonly (number | undefined)[],
  columns: number,
  gap: number,
): number[] | null {
  const later = Array.from({ length: Math.max(columns - 1, 0) }, (_, i) => natural[i + 1])
  const measured = later.flatMap((width) => (width === undefined ? [] : [width]))
  if (measured.length !== later.length) {
    return null
  }
  const widths = [...measured]
  const trailing = widths.length - 1
  let left = room - gap * (columns - 1) - (widths[trailing] ?? 0)
  // Column 0 is always one of the columns still waiting for a share.
  let waiting = columns - 1
  const middle = widths.slice(0, trailing).map((width, i) => ({ width, i }))
  for (const { width, i } of middle.sort((a, b) => a.width - b.width)) {
    const share = Math.max(left, 0) / waiting
    widths[i] = Math.min(width, share)
    left -= widths[i]
    waiting -= 1
  }
  return widths
}

type PassageTableProps = Omit<PassageProps, 'blocks'> & {
  rows: readonly TableRow[]
  blocks: readonly Block[]
  resolved: readonly ResolvedBlock[]
  plain: ResolvedBlock
}

/**
 * Swift's `Grid`: the first column takes the slack, later columns size to their widest
 * cell, and the last column sits at the trailing edge (USFM's right-aligned `\tcr`
 * counts, which the API HTML no longer marks). Each cell is a full block, so verse
 * labels, notes, highlights, and selection work inside it.
 */
function PassageTable({ rows, blocks, resolved, plain, ...rest }: PassageTableProps): ReactNode {
  const { look, onBlockLayout } = rest
  const columns = rows[0]?.cells.length ?? 0
  // Natural widths per column. A new look or new cell content (notes or verse numbers
  // toggled) drops them. onLayout fires only on a changed frame, so the new generation
  // remounts the measurers and every cell reports again, the widest included.
  const [widths, setWidths] = useState<{
    look: PassageLook
    blocks: readonly Block[]
    byColumn: number[]
    generation: number
  }>({ look, blocks, byColumn: [], generation: 0 })
  if (widths.look !== look || widths.blocks !== blocks) {
    setWidths({ look, blocks, byColumn: [], generation: widths.generation + 1 })
  }
  const { byColumn, generation } = widths
  // The width inside the table's padding, from its own layout.
  const [room, setRoom] = useState<number | null>(null)
  const shared = room === null ? null : tableColumnWidths(room, byColumn, columns, TABLE_COLUMN_GAP)
  const fit = (col: number, width: number): void =>
    setWidths((state) => {
      const next = Math.ceil(width)
      if (state.generation !== generation || (state.byColumn[col] ?? 0) >= next) {
        return state
      }
      const grown = [...state.byColumn]
      grown[col] = next
      return { ...state, byColumn: grown }
    })

  // Cells report y within their row; the reader needs it within the passage.
  const layout = useRef<TableLayout>({
    table: null,
    rows: new Map<number, number>(),
    cells: new Map<number, { row: number; y: number; height: number }>(),
    report: onBlockLayout,
  })
  layout.current.report = onBlockLayout
  const emit = useCallback((index: number): void => {
    const { table, rows: rowYs, cells, report } = layout.current
    const cell = cells.get(index)
    const rowY = cell === undefined ? undefined : rowYs.get(cell.row)
    if (table === null || cell === undefined || rowY === undefined) {
      return
    }
    report?.(index, table + rowY + cell.y, cell.height)
  }, [])
  const emitAll = (): void => {
    for (const index of layout.current.cells.keys()) {
      emit(index)
    }
  }
  const onCellLayout = useCallback(
    (index: number, y: number, height: number): void => {
      const row = layout.current.cells.get(index)?.row
      layout.current.cells.set(index, { row: row ?? -1, y, height })
      emit(index)
    },
    [emit],
  )
  const reportsLayout = onBlockLayout === undefined ? undefined : onCellLayout
  // Swift's cells carry leading only between lines; take back the half each cell's
  // line box adds above and below, so rows sit at Swift's pitch.
  const leading = lineLeading(look.fontSize, look.lineMultiple)

  return (
    <View
      onLayout={(event) => {
        layout.current.table = event.nativeEvent.layout.y
        setRoom(event.nativeEvent.layout.width - TABLE_PAD * 2)
        emitAll()
      }}
      style={{ paddingHorizontal: TABLE_PAD, paddingVertical: TABLE_PAD - leading / 2 }}
    >
      {rows.map((row, r) => (
        <View
          key={row.row}
          onLayout={(event) => {
            layout.current.rows.set(row.row, event.nativeEvent.layout.y)
            // Only this row moved; the table's own onLayout covers the rest.
            for (const index of row.cells) {
              if (index !== null) {
                emit(index)
              }
            }
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginTop: r === 0 ? 0 : TABLE_ROW_GAP - leading,
          }}
        >
          {row.cells.map((index, col) => {
            const last = col === columns - 1 && col > 0
            // Until every column is measured, a column takes its cell's own width.
            const width = shared === null ? byColumn[col] : shared[col - 1]
            const cellStyle: ViewStyle =
              col === 0
                ? { flex: 1, minWidth: 0 }
                : {
                    marginStart: TABLE_COLUMN_GAP,
                    flexShrink: last || shared !== null ? 0 : 1,
                    width,
                  }
            const block = index === null ? undefined : blocks[index]
            if (index === null || block === undefined) {
              return <View key={col} style={cellStyle} />
            }
            if (layout.current.cells.get(index)?.row !== row.row) {
              layout.current.cells.set(index, { row: row.row, y: 0, height: 0 })
            }
            return (
              <View key={col} style={cellStyle}>
                <View
                  key={generation}
                  onLayout={
                    col === 0 ? undefined : (event) => fit(col, event.nativeEvent.layout.width)
                  }
                  style={col === 0 ? undefined : { alignSelf: last ? 'flex-end' : 'flex-start' }}
                >
                  <BlockView
                    key={`${index}:${blockStateKey(block, rest)}`}
                    index={index}
                    block={block}
                    rule={resolved[index] ?? plain}
                    previous={null}
                    {...rest}
                    onBlockLayout={reportsLayout}
                  />
                </View>
              </View>
            )
          })}
        </View>
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
  indicators,
  onIndicatorPress,
  onBlockLayout,
  onBlockRef,
  probeVerses = null,
  onVerseLines,
}: BlockViewProps): ReactNode {
  const { t } = useSdkTranslation()
  const { fontSize } = look
  const lineBox = rule.size * look.lineMultiple
  const drift =
    -ATTACHMENT_DRIFT * rule.size * (look.lineMultiple - lineMultiple(READER_LINE_SPACING.DEFAULT))
  const blockDimmed = focus !== null && block.heading
  const hasSelection = block.verses.some((verse) => selected.has(verse))
  const hasPaint = block.verses.some((verse) => paint.has(verse))
  // A remount (see blockStateKey) starts from the last layout instead of blank, so a
  // tap does not flash the highlight away and back.
  const [measure, setMeasure] = useState<Measure>(() => {
    const kept = measures.get(block)
    if (kept?.look === look) {
      return { ...kept, originX: kept.originX ?? 0, textWidth: kept.textWidth ?? null }
    }
    return { look, lines: [], size: { width: 0, height: 0 }, space: 0, originX: 0, textWidth: null }
  })
  const { lines, size, space, originX, textWidth } = measure
  const endAligned = rule.align === 'end'
  const update = (change: Partial<Omit<Measure, 'look'>>): void =>
    setMeasure((current) => {
      const next = { ...current, ...change }
      measures.set(block, next)
      return next
    })
  const measured = hasSelection || hasPaint
  const reportLines = onVerseLines !== undefined && blockProbed(block, probeVerses)
  const onParagraphLayout = (event: TextLayoutEvent): void => {
    const laidOut = event.nativeEvent.lines
    if (measured) {
      update({ lines: laidOut })
    }
    if (onVerseLines !== undefined && reportLines) {
      onVerseLines(index, verseLineBoxes(laidOut, block, rule.smallCaps))
    }
  }
  const color = (value: string, alpha: number, dimmed: boolean): string => {
    const scale = dimmed ? alpha * DIM_ALPHA : alpha
    // Opaque hex stays hex. A fill that already has alpha (rgba or #rrggbbaa)
    // keeps it and only scales it when dimming.
    return scale === 1 ? value : scaleAlpha(value, scale)
  }

  // A ghost lays out exactly like the real text but paints only its layer.
  const renderInline = (
    inline: Inline,
    key: number,
    verse: number | null,
    dimmed: boolean,
    layer: Layer,
    last: boolean,
    after: Inline['kind'] | undefined,
  ): ReactNode => {
    const ghost = layer !== 'text'
    const fill = verse === null ? undefined : paint.get(verse)
    const overInk = ghost ? null : (fill?.text ?? null)
    const pressable = !ghost && verse !== null && onVersePress !== undefined
    // Inline views fill the line box (Android: the band's ascent) so a highlight runs
    // through them; the content shifts back by the same amount to stay where it was.
    const background = backdrop(layer, fill, dimmed)
    const box = {
      height: CAP_BOX ? Math.min(lineBox, BAND_ASCENT * rule.size) : lineBox,
      justifyContent: 'flex-end',
      transform: [{ translateY: BOX_SHIFT }],
      backgroundColor: CAP_BOX ? undefined : background,
    } as const
    // The capped box stops at the baseline, so its fill reaches on through the band's
    // descent; each line's band window trims the rest.
    const boxFill = CAP_BOX && background !== undefined && (
      <View
        style={{
          position: 'absolute',
          top: -BOX_SHIFT,
          bottom: -BAND_DESCENT * rule.size,
          left: 0,
          right: 0,
          backgroundColor: background,
        }}
      />
    )
    const indicator = verse === null ? undefined : indicators?.get(verse)
    if (inline.kind === 'label' && indicator !== undefined && verse !== null) {
      const live = !ghost && onIndicatorPress !== undefined
      return (
        <IndicatorLabel
          key={key}
          verse={verse}
          text={indicator.inlinePadding ? `${NBSP}${inline.text}${NBSP}` : inline.text}
          indicator={indicator}
          live={live}
          onPress={live ? onIndicatorPress : pressable ? onVersePress : undefined}
          style={{ ...box, paddingEnd: fontSize * 0.25 }}
          boxFill={boxFill}
          textStyle={{
            ...look.labelFace,
            fontSize: fontSize * LABEL_SCALE,
            lineHeight: fontSize * LABEL_SCALE * 1.2,
            // Drop by INDICATOR_PAD_Y so vertical padding grows the chip into the
            // highlight instead of poking out above the band (Figma 13×22 chip).
            transform: [
              { translateY: fontSize * LABEL_RISE + drift - BOX_SHIFT + INDICATOR_PAD_Y },
            ],
          }}
          // Ghost layers keep the marker's box so they lay out alike, but paint nothing.
          // Marker fill is its own; do not borrow highlight ink or a light number
          // disappears on a light chip over a dark swatch.
          foreground={
            ghost
              ? TRANSPARENT
              : color(indicator.foregroundColor ?? look.label, 1, dimmed)
          }
          background={ghost ? undefined : color(indicator.backgroundColor, 1, dimmed)}
        />
      )
    }
    if (inline.kind === 'label') {
      return (
        // End padding, not a trailing space: under RTL the space lands on the far side.
        <Pressable
          key={key}
          disabled={!pressable}
          onPress={pressable ? () => onVersePress(verse) : undefined}
          style={{ ...box, paddingEnd: fontSize * 0.25 }}
        >
          {boxFill}
          <RNText
            allowFontScaling={false}
            style={{
              ...look.labelFace,
              fontSize: fontSize * LABEL_SCALE,
              lineHeight: fontSize * LABEL_SCALE * 1.2,
              color: ghost ? TRANSPARENT : color(overInk ?? look.label, 1, dimmed),
              transform: [{ translateY: fontSize * LABEL_RISE + drift - BOX_SHIFT }],
            }}
          >
            {inline.text}
          </RNText>
        </Pressable>
      )
    }
    if (inline.kind === 'note') {
      const size = fontSize * NOTE_SCALE
      return (
        <Fragment key={key}>
          {after === 'text' && <RNText>{WORD_JOINER}</RNText>}
          <Pressable
            hitSlop={8}
            disabled={ghost}
            accessibilityRole="button"
            accessibilityLabel={t('footnoteAriaLabel')}
            onPress={ghost ? undefined : () => onNotePress(verse, inline.html)}
            style={{
              ...box,
              paddingStart: fontSize * NOTE_LEAD,
              paddingEnd: fontSize * NOTE_TRAIL,
            }}
          >
            {boxFill}
            <View
              style={{
                width: size,
                height: size,
                transform: [{ translateY: drift - BOX_SHIFT - fontSize * NOTE_RISE }],
              }}
            >
              {!ghost && (
                <Svg width={size} height={size} viewBox="0 0 20 20">
                  <Path d={NOTE_ICON} fill={color(palette.gray20, 1, dimmed)} fillRule="evenodd" />
                </Svg>
              )}
            </View>
          </Pressable>
        </Fragment>
      )
    }
    const chars = resolveChars(inline.classes)
    const weight = chars.weight ?? rule.weight
    const size = chars.scale === null ? rule.size : rule.size * chars.scale
    const wj =
      chars.wordsOfJesus && overInk === null && !ghost ? color(look.wj, 1, dimmed) : undefined
    if (chars.raised) {
      // Same raise as the verse label; an inline view inherits nothing, so set the ink here.
      return (
        <Pressable
          key={key}
          disabled={!pressable}
          onPress={pressable ? () => onVersePress(verse) : undefined}
          style={box}
        >
          {boxFill}
          <RNText
            allowFontScaling={false}
            style={{
              ...look.face(weight, chars.italic ?? rule.italic),
              fontSize: size,
              lineHeight: size * 1.2,
              color: ghost ? TRANSPARENT : (wj ?? color(overInk ?? look.ink, 1, dimmed)),
              transform: [{ translateY: fontSize * LABEL_RISE + drift - BOX_SHIFT }],
            }}
          >
            {inline.text}
          </RNText>
        </Pressable>
      )
    }
    // A verse's trailing space stays unpainted, so its padded highlight stops short
    // of the next verse label.
    const trailing = last ? (/\s+$/.exec(inline.text)?.[0] ?? '') : ''
    const text = inline.text.slice(0, inline.text.length - trailing.length)
    return (
      <Fragment key={key}>
        {after === 'label' && <RNText>{WORD_JOINER}</RNText>}
        <RNText
          style={{
            ...look.face(weight, chars.italic ?? rule.italic),
            color: wj,
            fontSize: chars.scale === null ? undefined : size,
          }}
        >
          {chars.smallCaps || rule.smallCaps ? smallCaps(text, size) : text}
          {trailing !== '' && (
            <RNText style={{ backgroundColor: isFill(layer) ? TRANSPARENT : undefined }}>
              {trailing}
            </RNText>
          )}
        </RNText>
      </Fragment>
    )
  }

  const paragraph = (layer: Layer): ReactNode => {
    const ghost = layer !== 'text'
    // textAlign is start-relative under RTL; see ADR 0023.
    let textAlign: 'left' | 'center' | 'right' = 'left'
    if (rule.align === 'center') {
      textAlign = 'center'
    } else if (rule.align === 'right' || endAligned) {
      textAlign = 'right'
    }
    // End lines: the row pins a short pause; flexShrink + maxWidth let a long one wrap
    // inside the column. textAlign keeps wrapped lines on the trailing edge.
    const paragraphStyle: TextStyle = {
      fontSize: rule.size,
      lineHeight: lineBox,
      color: ghost ? TRANSPARENT : color(look.ink, 1, blockDimmed),
      ...look.face(rule.weight, rule.italic),
      textAlign,
      writingDirection: look.rtl ? 'rtl' : 'ltr',
      paddingStart: rule.headIndent + rule.alignInset.start + highlightEndRoom(look.fontSize),
      paddingEnd: rule.alignInset.end + highlightEndRoom(look.fontSize),
    }
    if (ghost && textWidth !== null) {
      // A shrink-wrapped block (a table cell) can round a fraction under its text, which
      // would wrap a ghost ("2,172" as "2,17" / "2") off its line. Copy the real width.
      paragraphStyle.width = textWidth
    } else if (endAligned) {
      paragraphStyle.flexShrink = 1
      paragraphStyle.maxWidth = '100%'
    }
    const node = (
      <RNText
        ref={ghost || onBlockRef === undefined ? undefined : (node) => onBlockRef(index, node)}
        onTextLayout={ghost || (!measured && !reportLines) ? undefined : onParagraphLayout}
        onLayout={
          ghost || (!endAligned && !measured)
            ? undefined
            : (event) => {
                const { width } = event.nativeEvent.layout
                const x = endAligned ? event.nativeEvent.layout.x : 0
                if (originX !== x || textWidth !== width) {
                  update({ originX: x, textWidth: width })
                }
              }
        }
        allowFontScaling={false}
        style={paragraphStyle}
      >
        {/* iOS reads paragraph style (lineHeight) from the first character; an
          inline View there drops it for the whole block, so lead with text. */}
        {PARAGRAPH_ANCHOR}
        {directionMark(look.rtl)}
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
              onPress={
                ghost || verse === null || onVersePress === undefined
                  ? undefined
                  : () => onVersePress(verse)
              }
              style={{
                color: ghost ? TRANSPARENT : color(ink, 1, dimmed),
                backgroundColor:
                  layer === 'underline'
                    ? isSelected
                      ? look.underline
                      : undefined
                    : backdrop(layer, fill, dimmed),
              }}
            >
              {segment.inlines.map((inline, i) =>
                renderInline(
                  inline,
                  i,
                  verse,
                  dimmed,
                  layer,
                  i === segment.inlines.length - 1,
                  segment.inlines[i - 1]?.kind,
                ),
              )}
            </RNText>
          )
        })}
      </RNText>
    )
    if (!endAligned) {
      return node
    }
    return <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>{node}</View>
  }

  const onLayout = (event: LayoutChangeEvent): void => {
    onBlockLayout?.(index, event.nativeEvent.layout.y, event.nativeEvent.layout.height)
    const { width, height } = event.nativeEvent.layout
    if (size.width !== width || size.height !== height) {
      update({ size: { width, height } })
    }
  }

  // Nested text takes no padding, so the backdrop paints highlights from shifted
  // copies whose union reaches the end room past each end without reflowing. The
  // centred copy is last so it wins where two colours meet. A line whose sample is
  // not its band top keeps its own clipped copy so the window still shows the
  // translated sample, not the natural pixels at that y.
  const room = highlightEndRoom(look.fontSize)
  const pad = highlightEndRoom(rule.size)
  let windows: LineWindow[] = []
  if (hasPaint) {
    windows = lines.map((line) => {
      const opening = lineWindow(
        line,
        space,
        look.rtl,
        rule.headIndent + rule.alignInset.start + room,
        rule.alignInset.end + room,
        pad,
        rule.size,
      )
      // End-aligned text is shrink-wrapped and shifted by the row; line metrics stay
      // local to that text, so slide the window by the text's origin in the block.
      if (originX === 0) {
        return opening
      }
      return { ...opening, left: opening.left + originX }
    })
  }
  const shareBackdrop =
    windows.length > 0 && windows.every((opening) => opening.sample === opening.top)
  const backdropLayers = (focus === null ? FILL_LAYERS.slice(0, 1) : FILL_LAYERS).map((layer) => (
    <View
      key={layer}
      needsOffscreenAlphaCompositing={layer === 'dimFill'}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: layer === 'dimFill' ? DIM_ALPHA : 1,
      }}
    >
      {[-1, 1, 0].map((side) => (
        <View
          key={side}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: [{ translateX: side * pad }],
          }}
        >
          {paragraph(layer)}
        </View>
      ))}
    </View>
  ))

  const text = paragraph('text')
  // A text underline breaks around descenders on iOS, so the ghost paints selected
  // verses as a fill and each line clips it to a strip under its baseline.
  const underline = hasSelection ? paragraph('underline') : null
  return (
    <View
      onLayout={onLayout}
      style={{
        marginTop: collapsedMarginTop(rule, previous, fontSize),
        marginBottom: blockMarginBottom(rule, fontSize),
      }}
    >
      {shareBackdrop && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            overflow: 'hidden',
          }}
        >
          {backdropLayers}
        </View>
      )}
      {shareBackdrop &&
        coverRects(size, windows, 1 / PixelRatio.get()).map((rect, coverIndex) => (
          <View
            key={coverIndex}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              ...leftEdge(rect.x, look.rtl),
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: look.background,
            }}
          />
        ))}
      {hasPaint &&
        !shareBackdrop &&
        windows.map((opening, lineIndex) => (
          <View
            key={lineIndex}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: opening.top,
              ...leftEdge(opening.left, look.rtl),
              width: opening.width,
              height: opening.height,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: -opening.sample,
                ...leftEdge(-opening.left, look.rtl),
                width: size.width,
                height: size.height,
              }}
            >
              {backdropLayers}
            </View>
          </View>
        ))}
      {text}
      {hasSelection &&
        lines.map((line, lineIndex) => {
          const top = underlineTop(line, rule.size)
          const sample = sampleTop(line, top, UNDERLINE_THICKNESS)
          const span = lineSpan(
            line,
            space,
            look.rtl,
            rule.headIndent + rule.alignInset.start + highlightEndRoom(look.fontSize),
            rule.alignInset.end + highlightEndRoom(look.fontSize),
          )
          const left = span.x + originX
          return (
            <View
              key={lineIndex}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: 'absolute',
                top,
                ...leftEdge(left, look.rtl),
                width: span.width,
                height: UNDERLINE_THICKNESS,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: -sample,
                  ...leftEdge(-left, look.rtl),
                  width: size.width,
                }}
              >
                {underline}
              </View>
            </View>
          )
        })}
      {measured && TRIM_TRAILING_SPACE && (
        // One space in the block's face, to trim trailing spaces off each line.
        <RNText
          allowFontScaling={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(event) => update({ space: event.nativeEvent.lines[0]?.width ?? 0 })}
          style={{
            position: 'absolute',
            opacity: 0,
            fontSize: rule.size,
            ...look.face(rule.weight, rule.italic),
          }}
        >
          {NBSP}
        </RNText>
      )}
    </View>
  )
}, sameBlockState)

type TextLine = TextLayoutEvent['nativeEvent']['lines'][number]

type Measure = {
  look: PassageLook
  lines: readonly TextLine[]
  size: { width: number; height: number }
  space: number
  /** Left edge of shrink-wrapped end-aligned text inside the block; 0 when full width. */
  originX: number
  /** Laid-out width of the real paragraph, which its ghosts copy; null until measured. */
  textWidth: number | null
}

// Last layout per parsed block, valid while its look holds.
const measures = new WeakMap<Block, Measure>()

// Both platforms centre the glyphs in a line box enlarged by lineHeight.
function baselineOf(line: TextLine): number {
  return line.y + (line.height + line.ascender - Math.abs(line.descender)) / 2
}

function underlineTop(line: TextLine, size: number): number {
  return baselineOf(line) + UNDERLINE_OFFSET * size
}

// Where a window at `top` reads the ghost's fill. A band or underline strip that spills
// past its line box (Android at tight spacing) would show the next line's fill, so it
// reads from the middle of its own line instead.
export function sampleTop(
  line: { y: number; height: number },
  top: number,
  height: number,
): number {
  return top + height <= line.y + line.height ? top : line.y + (line.height - height) / 2
}

type Band = { top: number; height: number }

// Swift fills a line's typographic bounds, so line spacing shows as a gap between
// highlighted lines. iOS line metrics span the whole line box, so the font's ascent
// and descent are em values measured off Swift's serif.
function glyphBand(line: TextLine, size: number): Band {
  return {
    top: baselineOf(line) - BAND_ASCENT * size,
    height: (BAND_ASCENT + BAND_DESCENT) * size,
  }
}

type LineSpan = { x: number; width: number }

// The line's text without its trailing spaces, which sit on the left under RTL.
// Line x is measured inside the padding, so each side shifts back out to the block.
function lineSpan(
  line: TextLine,
  space: number,
  rtl: boolean,
  paddingStart: number,
  paddingEnd: number,
): LineSpan {
  const trailing = TRIM_TRAILING_SPACE ? (/[ \u00a0]*$/.exec(line.text)?.[0].length ?? 0) : 0
  const trim = Math.min(trailing * space, line.width)
  const x = rtl ? line.x + trim + paddingEnd : line.x + paddingStart
  return { x, width: line.width - trim }
}

export type LineWindow = {
  left: number
  top: number
  width: number
  height: number
  sample: number
}

export type CoverRect = {
  x: number
  y: number
  width: number
  height: number
}

export function lineWindow(
  line: TextLine,
  space: number,
  rtl: boolean,
  paddingStart: number,
  paddingEnd: number,
  pad: number,
  size: number,
): LineWindow {
  const span = lineSpan(line, space, rtl, paddingStart, paddingEnd)
  const band = glyphBand(line, size)
  const left = span.x - pad
  const top = band.top
  const width = span.width + 2 * pad
  const height = band.height
  return {
    left,
    top,
    width,
    height,
    sample: sampleTop(line, top, height),
  }
}

// Covers that share a fractional edge can each round away from it and leave a pixel
// row of backdrop showing, so side covers and the last cover overlap by `seam`.
export function coverRects(
  box: { width: number; height: number },
  windows: readonly LineWindow[],
  seam = 0,
): CoverRect[] {
  const covers: CoverRect[] = []
  const push = (x: number, y: number, width: number, height: number): void => {
    const left = Math.max(x, 0)
    const top = Math.max(y, 0)
    const right = Math.min(x + width, box.width)
    const bottom = Math.min(y + height, box.height + seam)
    const nextWidth = right - left
    const nextHeight = bottom - top
    if (nextWidth <= 0 || nextHeight <= 0) {
      return
    }
    covers.push({ x: left, y: top, width: nextWidth, height: nextHeight })
  }

  let y = 0
  for (const opening of windows) {
    push(0, y, box.width, opening.top - y)
    y = opening.top + opening.height
  }
  push(0, y, box.width, box.height + seam - y)

  for (const opening of windows) {
    const top = opening.top - seam
    const height = opening.height + 2 * seam
    push(0, top, opening.left, height)
    push(opening.left + opening.width, top, box.width - (opening.left + opening.width), height)
  }

  return covers
}

const FILL_LAYERS = ['fill', 'dimFill'] as const

function isFill(layer: Layer): boolean {
  return layer === 'fill' || layer === 'dimFill'
}

// Opaque in both backdrops; the dimmed backdrop fades as a whole, so copies never stack.
function backdrop(
  layer: Layer,
  fill: HighlightPaint | undefined,
  dimmed: boolean,
): string | undefined {
  const painted = layer === (dimmed ? 'dimFill' : 'fill')
  return painted ? fill?.background : undefined
}

// Fabric iOS misplaces inline-View attachments (labels, note icons) when a
// paragraph re-renders in place; a remount lays them out fresh.
function blockProbed(block: Block, probeVerses: readonly number[] | null | undefined): boolean {
  if (probeVerses == null) {
    return false
  }
  return block.verses.some((verse) => probeVerses.includes(verse))
}

function blockStateKey(block: Block, state: Omit<PassageProps, 'blocks'>): string {
  const { look } = state
  const focused = state.focus === null ? 'n' : 'f'
  // Remount when a focus starts measuring lines. An in-place update does not emit them again.
  const probe = blockProbed(block, state.probeVerses) ? 'p' : '.'
  const looks = `${look.fontSize}|${look.lineMultiple}|${look.face(400, false).fontFamily}|${look.ink}|${look.label}|`
  return (
    looks +
    focused +
    probe +
    block.verses
      .map(
        (verse) =>
          `${state.selected.has(verse) ? 's' : ''}${state.paint.get(verse)?.background ?? ''}${state.focus?.has(verse) ? 'f' : ''}${indicatorKey(state.indicators?.get(verse))}`,
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
    a.onIndicatorPress !== b.onIndicatorPress ||
    a.onBlockLayout !== b.onBlockLayout ||
    a.onBlockRef !== b.onBlockRef ||
    a.onVerseLines !== b.onVerseLines ||
    blockProbed(a.block, a.probeVerses) !== blockProbed(b.block, b.probeVerses) ||
    (a.focus === null) !== (b.focus === null)
  ) {
    return false
  }
  return a.block.verses.every(
    (verse) =>
      a.selected.has(verse) === b.selected.has(verse) &&
      a.paint.get(verse) === b.paint.get(verse) &&
      (a.focus?.has(verse) ?? false) === (b.focus?.has(verse) ?? false) &&
      indicatorKey(a.indicators?.get(verse)) === indicatorKey(b.indicators?.get(verse)),
  )
}

// By value: a host resolver returns fresh style objects on every chapter build.
function indicatorKey(style: VerseIndicatorStyle | undefined): string {
  if (style === undefined) {
    return ''
  }
  const { backgroundColor, foregroundColor, minimumHitSize, inlinePadding, accessibilityLabel } =
    style
  return `|i${backgroundColor}/${foregroundColor ?? ''}/${minimumHitSize ?? ''}/${inlinePadding ? 1 : 0}/${accessibilityLabel ?? ''}`
}

const DEFAULT_INDICATOR_HIT = 44

type IndicatorLabelProps = {
  verse: number
  text: string
  indicator: VerseIndicatorStyle
  live: boolean
  onPress: ((verse: number) => void) | undefined
  style: ViewStyle
  boxFill: ReactNode
  textStyle: TextStyle
  foreground: string
  background: string | undefined
}

function IndicatorLabel({
  verse,
  text,
  indicator,
  live,
  onPress,
  style,
  boxFill,
  textStyle,
  foreground,
  background,
}: IndicatorLabelProps): ReactNode {
  const minimum = indicator.minimumHitSize ?? DEFAULT_INDICATOR_HIT
  return (
    <Pressable
      testID={live ? `verse-indicator-${verse}` : undefined}
      disabled={onPress === undefined}
      onPress={onPress === undefined ? undefined : () => onPress(verse)}
      accessible={live ? true : undefined}
      accessibilityRole={live ? 'button' : undefined}
      accessibilityLabel={live ? (indicator.accessibilityLabel ?? text.trim()) : undefined}
      style={style}
    >
      {boxFill}
      <RNText
        allowFontScaling={false}
        style={{
          ...textStyle,
          color: foreground,
          backgroundColor: background,
          borderRadius: INDICATOR_RADIUS,
          overflow: 'hidden',
          paddingVertical: INDICATOR_PAD_Y,
        }}
      >
        {text}
      </RNText>
      {live && (
        <View
          testID={`verse-indicator-hit-${verse}`}
          collapsable={false}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: minimum,
            height: minimum,
            marginLeft: -minimum / 2,
            marginTop: -minimum / 2,
          }}
        />
      )}
    </Pressable>
  )
}

// Neither Untitled Serif nor Source Serif answers `fontVariant: small-caps` on iOS,
// so uppercase lowercase runs at a smaller size. Swift's `lowercaseSmallCaps()` glyphs
// are 0.86× cap height and wider than scaled caps, so tracking makes up the width.
const SMALL_CAP_SCALE = 0.85
const SMALL_CAP_TRACKING = 0.055

export function smallCaps(text: string, size: number): ReactNode[] {
  return Array.from(text.matchAll(/(\p{Ll}+)|([^\p{Ll}]+)/gu), (match, i) =>
    match[1] === undefined ? (
      match[0]
    ) : (
      <RNText
        key={i}
        style={{ fontSize: size * SMALL_CAP_SCALE, letterSpacing: size * SMALL_CAP_TRACKING }}
      >
        {applySmallCaps(match[1])}
      </RNText>
    ),
  )
}

// Web SDK footnote glyph (20×20 note bubble).
const NOTE_ICON =
  'M5.00033 4.16667C4.09255 4.16667 3.33366 4.92556 3.33366 5.83333V12.5C3.33366 13.4078 4.09255 14.1667 5.00033 14.1667H6.66699C7.12723 14.1667 7.50033 14.5398 7.50033 15V16.0282L10.4049 14.2854C10.5344 14.2077 10.6826 14.1667 10.8337 14.1667H15.0003C15.9081 14.1667 16.667 13.4078 16.667 12.5V5.83333C16.667 4.92556 15.9081 4.16667 15.0003 4.16667H5.00033ZM5.00033 2.5H15.0003C16.8159 2.5 18.3337 4.01778 18.3337 5.83333V12.5C18.3337 14.3156 16.8159 15.8333 15.0003 15.8333H11.0645L7.09574 18.2146C6.55059 18.5417 5.83366 18.1357 5.83366 17.5V15.8333H5.00033C3.18477 15.8333 1.66699 14.3156 1.66699 12.5V5.83333C1.66699 4.01778 3.18477 2.5 5.00033 2.5ZM5.83366 7.5C5.83366 7.03976 6.20675 6.66667 6.66699 6.66667H13.3337C13.7939 6.66667 14.167 7.03976 14.167 7.5C14.167 7.96024 13.7939 8.33333 13.3337 8.33333H6.66699C6.20675 8.33333 5.83366 7.96024 5.83366 7.5ZM5.83366 10.8333C5.83366 10.3731 6.20675 10 6.66699 10H11.667C12.1272 10 12.5003 10.3731 12.5003 10.8333C12.5003 11.2936 12.1272 11.6667 11.667 11.6667H6.66699C6.20675 11.6667 5.83366 11.2936 5.83366 10.8333Z'

import type { ComponentType, ReactNode } from 'react'
import { Platform, Text, View } from 'react-native'

import { SOURCE_SERIF_FONT, type FontFamily } from '../../lib/reader-fonts'
import type { Theme } from '../../lib/resolve-theme'
import { SCRIPT_SCALE, Subscript, Superscript } from './baseline-shift'
import { FootnoteMarkerIcon } from './scripture-footnote-icon'
import { parseScriptureHtml } from './parse-scripture-html'
import {
  INLINE_STYLES,
  SPACER_CLASSES,
  getBlockSpec,
  resolveBlockTextStyle,
  resolveInlineTextStyle,
  type ScriptureStyleContext,
} from './scripture-class-styles'
import { resolveBodyFontFamily, resolveLabelFontFamily } from './scripture-fonts'
import { SCRIPTURE_PALETTE } from './scripture-theme'
import type { ScriptureElementNode, ScriptureNode } from './types'

export {
  Superscript,
  Subscript,
  SCRIPT_SCALE,
  SUPERSCRIPT_RISE_EM,
  SUBSCRIPT_DROP_EM,
} from './baseline-shift'

const NBSP = ' '
/** CSS root `line-height` for `[data-slot='yv-bible-renderer']`. */
const DEFAULT_LINE_HEIGHT = 1.625
const DEFAULT_FONT_SIZE = 20
/** U+2003 EM SPACE ≈ 1em; emulates CSS first-line `text-indent` (no RN equivalent). */
const EM_SPACE = ' '

/** A single note within a verse (one footnote anchor). */
export type ScriptureFootnoteNote = {
  /** Note marker letter (`a`, `b`, …) — matches the in-verse superscript. */
  letter: string
  /** Plain-text note content (tags stripped). */
  text: string
  /** Raw inner HTML of the note, when available. */
  html?: string
}

/**
 * A run of the verse text shown in the footnote drawer: either a text segment or
 * a note marker (rendered as a superscript letter at the note's position).
 */
export type ScriptureVerseToken =
  | { type: 'text'; text: string }
  | { type: 'note'; letter: string }

/**
 * A footnote surfaced to the built-in drawer when its inline marker is pressed.
 * Carries the verse context the Web SDK's footnote drawer shows: the verse
 * reference, the verse text (with note positions), and every note in that verse.
 */
export type ScriptureFootnote = {
  verseNumber?: string
  /** Human display reference of the verse, e.g. `"Acts 15:2"`, when available. */
  reference?: string
  /** Verse text as text/note tokens, so the drawer can mark each note position. */
  verseTokens: ScriptureVerseToken[]
  /** Every note in that verse, in document order. */
  notes: ScriptureFootnoteNote[]
}

export type RenderScriptureOptions = {
  theme: Theme
  fontSize?: number
  fontFamily?: FontFamily
  lineHeightMultiplier?: number
  /** Passage USFM (e.g. `"ACT.15"`); USFM fallback for per-verse footnote references. */
  usfm?: string
  /** Human passage reference (e.g. `"Acts 15"`); preferred for footnote references. */
  reference?: string
  onVersePress?: (verseNumber: string) => void
  onFootnotePress?: (footnote: ScriptureFootnote) => void
  /**
   * Injected native renderer for poetry/list **hanging** indent (ADR 0011). When
   * provided, hanging-class blocks (`.q*`/`.li*`) render through it — a faithful
   * first-line/wrapped hang via platform paragraph styles — instead of the uniform
   * `paddingLeft` approximation. Footnote-bearing blocks bail to the RN path (v1).
   */
  renderHangingParagraph?: HangingParagraphRenderer
}

/** A styled run of scripture text, serialized for the native hanging-paragraph renderer. */
export type ScriptureRun = {
  text: string
  fontSize: number
  /** Pre-resolved family per weight/style, e.g. `SourceSerif4_700Bold`. */
  fontFamily?: string
  /** Hex colour. */
  color?: string
  bold?: boolean
  italic?: boolean
  smallCaps?: boolean
  /** Baseline shift as a fraction of fontSize (positive = up, for superscripts). */
  baselineShiftEm?: number
  /** Render the note-bubble footnote icon for this run (text is empty). */
  footnote?: boolean
  /** Footnote index reported via `onFootnotePress` when the bubble is tapped. */
  footnoteIndex?: number
}

export type HangingParagraphProps = {
  runs: ScriptureRun[]
  /** First-line indent in px. */
  firstIndent: number
  /** Wrapped-line indent in px (the hang). */
  restIndent: number
  lineHeightMultiple: number
  onVersePress?: () => void
  /** Fired with a marker's `footnoteIndex` when its note bubble is tapped. */
  onFootnotePress?: (footnoteIndex: number) => void
}

/** Native component (iOS/Android) that applies a true hanging indent. */
export type HangingParagraphRenderer = ComponentType<HangingParagraphProps>

const CONTAINER_TAGS = new Set(['div', 'section', 'table', 'thead', 'tbody', 'tr', 'td', 'th'])

function buildContext(options: RenderScriptureOptions): ScriptureStyleContext {
  return {
    baseFontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
    lineHeightMultiplier: options.lineHeightMultiplier ?? DEFAULT_LINE_HEIGHT,
    fontFamily: options.fontFamily ?? SOURCE_SERIF_FONT,
    palette: SCRIPTURE_PALETTE[options.theme],
  }
}

function isElement(node: ScriptureNode): node is ScriptureElementNode {
  return node.type === 'element'
}

function hasClass(node: ScriptureElementNode, cls: string): boolean {
  return node.classes.includes(cls)
}

function isVerseMarker(node: ScriptureNode): node is ScriptureElementNode {
  return isElement(node) && hasClass(node, 'yv-v') && node.attrs.verseNumber != null
}

function isFootnote(node: ScriptureNode): boolean {
  return isElement(node) && (hasClass(node, 'yv-n') || node.attrs.footnoteKey != null)
}

function isSpacer(node: ScriptureNode): boolean {
  return isElement(node) && node.classes.some((cls) => SPACER_CLASSES.has(cls))
}

/**
 * A node carrying inline reading content directly — a text run, a verse marker, or
 * an inline `<span>`. Used to tell a paragraph (wraps inline content) from a
 * structural container (wraps other blocks): a `<div>` with an unmapped USFM
 * paragraph class still holds verse text, so it must flow as one paragraph, not be
 * split child-by-child into stacked blocks.
 */
function hasInlineContent(node: ScriptureElementNode): boolean {
  return node.children.some(
    (child) =>
      (child.type === 'text' && child.text.trim() !== '') ||
      (isElement(child) && (child.tag === 'span' || isVerseMarker(child))),
  )
}

function isContainer(node: ScriptureElementNode): boolean {
  if (node.tag === 'p' || !CONTAINER_TAGS.has(node.tag)) return false
  if (getBlockSpec(node.classes) !== undefined) return false
  // A block-tag element wrapping inline content is a paragraph with an unmapped
  // class, not a container — otherwise its verse text stacks vertically.
  return !hasInlineContent(node)
}

function isParagraphBlock(node: ScriptureElementNode): boolean {
  if (node.tag === 'p' || getBlockSpec(node.classes) !== undefined) return true
  // Unmapped USFM paragraph class on a block-tag element: render as a plain
  // paragraph (verse grouping + inline flow) rather than a vertical container stack.
  return CONTAINER_TAGS.has(node.tag) && hasInlineContent(node)
}

/** Flatten a node subtree to plain text (footnote content, fallback rendering). */
function textContent(node: ScriptureNode): string {
  if (node.type === 'text') return node.text
  return node.children.map(textContent).join('')
}

/** Strip tags from a footnote's escaped inner-HTML attribute to plain text. */
function htmlToText(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

// Footnote marker icon (the note bubble). The Web SDK renders it at 1.5em in the
// muted (gray-20) color, vertically centered — not superscripted. It sits inline
// as a real `<View>` in the flowing verse `<Text>`, so its baseline alignment is
// platform-sensitive like the baseline shift used for super/subscript; the vertical
// nudge is tunable and needs device checks.
export const FOOTNOTE_ICON_EM = 1.5
export const FOOTNOTE_ICON_DROP_EM = Platform.select({ android: 0.45, default: 0.35 })

// Inline character classes the SDK CSS renders raised (super) or lowered (sub).
// Cross-references (`.x`) are intentionally absent: they are dropped at parse time
// (HIDDEN_CLASSES in parse-scripture-html), matching the Web SDK reader which hides
// them by default, so a `crossref` superscript style would never apply.
const SUPERSCRIPT_CLASSES = new Set(['sup', 'ord', 'vp', 'fv', 'footnote'])
const SUBSCRIPT_CLASSES = new Set(['sub'])

type VerseSegment = { verse?: string; nodes: ScriptureNode[] }

/**
 * Group a paragraph's children into verse runs. An empty `.yv-v[v]` element is a
 * raw start marker (following siblings belong to it); a populated one is a
 * transformed wrapper (its children are the verse). Mirrors `transformBibleHtml`'s
 * verse-wrapping intent without rewriting HTML.
 *
 * A verse can run past the end of its block (poetry lines, list items, continuation
 * paragraphs all carry the *previous* verse until the next marker). `incomingVerse`
 * is that carried-over verse number from the prior block, so the leading content of
 * this block is attributed to it rather than orphaned with no verse/reference.
 */
function groupVerses(children: ScriptureNode[], incomingVerse?: string): VerseSegment[] {
  const segments: VerseSegment[] = []
  let current: VerseSegment = { verse: incomingVerse, nodes: [] }

  const flush = () => {
    if (current.verse != null || current.nodes.length > 0) segments.push(current)
  }

  for (const child of children) {
    if (isVerseMarker(child)) {
      flush()
      if (child.children.length > 0) {
        // Populated wrapper: it is the whole verse. Trailing siblings sit between
        // verses (transformed shape is block-contained), so they carry no verse.
        segments.push({ verse: child.attrs.verseNumber, nodes: child.children })
        current = { nodes: [] }
      } else {
        current = { verse: child.attrs.verseNumber, nodes: [] }
      }
      continue
    }
    current.nodes.push(child)
  }
  flush()
  return segments
}

/** Resolved verse of the last segment — the verse carried into the next block. */
function trailingVerse(segments: VerseSegment[], incomingVerse?: string): string | undefined {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]!.verse != null) return segments[i]!.verse
  }
  return incomingVerse
}

/**
 * Verse-level context threaded to footnote markers so a tapped note can surface
 * the same drawer the Web SDK shows: verse reference, verse text (with note
 * positions), and all notes.
 */
type VerseContext = {
  verseNumber?: string
  reference?: string
  verseTokens: ScriptureVerseToken[]
  notes: ScriptureFootnoteNote[]
}

/** Note marker letter (`a`, `b`, …, `z`), wrapping back to `a` after `z`. */
export function footnoteLetter(index: number): string {
  return String.fromCharCode(97 + (index % 26))
}

/** Collapse whitespace in text tokens, drop empties, and trim the run's ends. */
function normalizeVerseTokens(tokens: ScriptureVerseToken[]): ScriptureVerseToken[] {
  const collapsed = tokens
    .map((t) => (t.type === 'text' ? { ...t, text: t.text.replace(/\s+/g, ' ') } : t))
    .filter((t) => t.type !== 'text' || t.text.length > 0)
  // Trim leading space of the first text token and trailing space of the last.
  const first = collapsed[0]
  if (first?.type === 'text') first.text = first.text.replace(/^\s+/, '')
  const last = collapsed[collapsed.length - 1]
  if (last?.type === 'text') last.text = last.text.replace(/\s+$/, '')
  return collapsed.filter((t) => t.type !== 'text' || t.text.length > 0)
}

/** Human/USFM display reference for a verse, e.g. `"Acts 15:2"`, when known. */
function buildReference(verseNumber: string, options: RenderScriptureOptions): string | undefined {
  if (options.reference) return `${options.reference}:${verseNumber}`
  if (options.usfm) return `${options.usfm}.${verseNumber}`
  return undefined
}

type VerseAccumulator = { tokens: ScriptureVerseToken[]; notes: ScriptureFootnoteNote[] }

/**
 * Append a verse run's reading-text tokens and note markers (each a letter shared
 * between the in-verse superscript and the notes list) onto an accumulator, skipping
 * verse labels. Mirrors the Web SDK's `getVerseHtmlFromDom`, which replaces each
 * footnote anchor with a `<sup>` letter in the displayed verse. Appending (rather
 * than building per run) lets a verse that spans blocks gather all its text and keep
 * one continuous note lettering (`a`, `b`, …) across those blocks.
 */
function appendVerseRun(nodes: ScriptureNode[], target: VerseAccumulator): void {
  for (const node of nodes) {
    if (node.type === 'text') {
      target.tokens.push({ type: 'text', text: node.text })
    } else if (isFootnote(node)) {
      const letter = footnoteLetter(target.notes.length)
      const html = node.attrs.footnoteContent
      target.notes.push({ letter, text: html ? htmlToText(html) : textContent(node), html })
      target.tokens.push({ type: 'note', letter })
    } else if (!hasClass(node, 'yv-vlbl')) {
      appendVerseRun(node.children, target)
    }
  }
}

/**
 * Build the full context for every verse in the document, keyed by verse number.
 *
 * Verses routinely run past their starting block — poetry lines, list items, and
 * continuation paragraphs carry the previous verse until the next marker. Grouping
 * per block (as rendering does for layout) would orphan those continuation runs:
 * a footnote tapped there would surface with no display reference and only the
 * sliver of verse text in its own block. So this walks the whole tree in document
 * order, threading the carried verse across block boundaries, and accumulates each
 * verse's complete text + notes. Footnote markers then look the verse up here by
 * number, so the drawer always shows the **whole** verse and its reference.
 */
function buildVerseContextMap(
  nodes: ScriptureNode[],
  options: RenderScriptureOptions,
): Map<string, VerseContext> {
  const acc = new Map<string, VerseAccumulator>()
  let carried: string | undefined

  const ensure = (verse: string): VerseAccumulator => {
    let entry = acc.get(verse)
    if (!entry) {
      entry = { tokens: [], notes: [] }
      acc.set(verse, entry)
    }
    return entry
  }

  // Cross-block runs of one verse are glued with a space so adjacent block text
  // (e.g. two poetry lines) does not collide; normalizeVerseTokens collapses it.
  const appendTo = (verse: string, runNodes: ScriptureNode[]) => {
    const entry = ensure(verse)
    if (entry.tokens.length > 0) entry.tokens.push({ type: 'text', text: ' ' })
    appendVerseRun(runNodes, entry)
  }

  const walkBlocks = (blockNodes: ScriptureNode[]) => {
    for (const node of blockNodes) {
      if (!isElement(node)) continue
      if (isContainer(node)) {
        walkBlocks(node.children)
        continue
      }
      if (!isParagraphBlock(node)) {
        // Inline element at block level — it belongs to the carried verse.
        if (carried != null) appendTo(carried, node.children)
        continue
      }
      const segments = groupVerses(node.children, carried)
      for (const seg of segments) {
        if (seg.verse != null) appendTo(seg.verse, seg.nodes)
      }
      carried = trailingVerse(segments, carried)
    }
  }
  walkBlocks(nodes)

  const map = new Map<string, VerseContext>()
  for (const [verseNumber, entry] of acc) {
    map.set(verseNumber, {
      verseNumber,
      reference: buildReference(verseNumber, options),
      verseTokens: normalizeVerseTokens(entry.tokens),
      notes: entry.notes,
    })
  }
  return map
}

function renderVerseLabel(
  node: ScriptureElementNode,
  ctx: ScriptureStyleContext,
  parentFontSize: number,
  key: string,
): ReactNode {
  // Real digits raised via <Superscript> (i18n-safe — works for any numeral
  // system). The trailing space sits outside the superscript so it stays
  // full-size and separates the number from the verse text.
  const label = textContent(node).trim()
  return (
    <Text key={key}>
      <Superscript
        fontSize={parentFontSize}
        color={ctx.palette.mutedForeground}
        fontFamily={resolveLabelFontFamily()}
      >
        {label}
      </Superscript>
      {NBSP}
    </Text>
  )
}

/**
 * Build the `ScriptureFootnote` drawer payload for a marker node. Shared by the RN
 * marker and the native hanging-paragraph path. Markers without verse context (inline
 * element at block level) still surface their own note as a single-item drawer.
 */
function buildFootnote(node: ScriptureElementNode, verse: VerseContext | undefined): ScriptureFootnote {
  const html = node.attrs.footnoteContent
  const fallback: ScriptureFootnoteNote = {
    letter: footnoteLetter(0),
    text: html ? htmlToText(html) : textContent(node),
    html,
  }
  return {
    verseNumber: verse?.verseNumber ?? node.attrs.footnoteKey,
    reference: verse?.reference,
    verseTokens: verse?.verseTokens ?? [],
    notes: verse?.notes ?? [fallback],
  }
}

function renderFootnoteMarker(
  node: ScriptureElementNode,
  ctx: ScriptureStyleContext,
  parentFontSize: number,
  verse: VerseContext | undefined,
  options: RenderScriptureOptions,
  key: string,
): ReactNode {
  const footnote = buildFootnote(node, verse)
  const onPress = options.onFootnotePress ? () => options.onFootnotePress?.(footnote) : undefined
  // The note-bubble icon is a real `<View>`/SVG (not text), so it flows inline in
  // the verse `<Text>` as an inline view and owns its own press target (the SVG
  // takes `onPress`) — no wrapping `<Text>` needed. Nudged down to sit centered on
  // the line; the source HTML already carries the space before the anchor.
  return (
    <View key={key} style={{ transform: [{ translateY: parentFontSize * FOOTNOTE_ICON_DROP_EM }] }}>
      <FootnoteMarkerIcon
        size={parentFontSize * FOOTNOTE_ICON_EM}
        color={ctx.palette.footnoteMarker}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Footnote"
      />
    </View>
  )
}

/** Render a run of inline nodes (text + character-style spans) into Text children. */
function renderInlineNodes(
  nodes: ScriptureNode[],
  ctx: ScriptureStyleContext,
  parentFontSize: number,
  verse: VerseContext | undefined,
  options: RenderScriptureOptions,
  keyPrefix: string,
): ReactNode[] {
  const out: ReactNode[] = []

  nodes.forEach((node, index) => {
    const key = `${keyPrefix}.${index}`

    if (node.type === 'text') {
      out.push(node.text)
      return
    }

    if (node.tag === 'br') {
      out.push('\n')
      return
    }

    if (isFootnote(node)) {
      out.push(renderFootnoteMarker(node, ctx, parentFontSize, verse, options, key))
      return
    }

    if (hasClass(node, 'yv-vlbl')) {
      out.push(renderVerseLabel(node, ctx, parentFontSize, key))
      return
    }

    // Body super/subscripts (`.sup`/`.ord`/`.vp`/`.fv`/`.sub`) render in an inline
    // `<View>` (see baseline-shift), which breaks RN's text inheritance across the
    // view boundary: the inner `<Text>` neither inherits the run's reader font (whose
    // metrics the rise was tuned against — omitting it drops the glyph) nor its color
    // (defaulting to black, invisible in dark mode). Thread both explicitly.
    if (node.classes.some((cls) => SUPERSCRIPT_CLASSES.has(cls))) {
      out.push(
        <Superscript
          key={key}
          fontSize={parentFontSize}
          color={ctx.palette.foreground}
          fontFamily={resolveBodyFontFamily(ctx.fontFamily)}
        >
          {textContent(node)}
        </Superscript>,
      )
      return
    }

    if (node.classes.some((cls) => SUBSCRIPT_CLASSES.has(cls))) {
      out.push(
        <Subscript
          key={key}
          fontSize={parentFontSize}
          color={ctx.palette.foreground}
          fontFamily={resolveBodyFontFamily(ctx.fontFamily)}
        >
          {textContent(node)}
        </Subscript>,
      )
      return
    }

    const inlineStyle = resolveInlineTextStyle(node.classes, ctx, parentFontSize)
    const childFontSize = inlineStyle.fontSize ?? parentFontSize
    const inner = renderInlineNodes(node.children, ctx, childFontSize, verse, options, key)
    out.push(
      <Text key={key} style={inlineStyle}>
        {inner}
      </Text>,
    )
  })

  return out
}

/**
 * Render-pass state threaded through block rendering: the document-wide verse
 * context map (so footnote markers surface the whole verse) and a mutable cursor
 * tracking the verse carried across block boundaries (so continuation blocks know
 * which verse they belong to).
 */
type RenderState = {
  verseMap: Map<string, VerseContext>
  cursor: { verse?: string }
}

/** Render a block's verse segments to pressable `<Text>` runs (shared by both paths). */
function renderVerseSegments(
  segments: VerseSegment[],
  ctx: ScriptureStyleContext,
  parentFontSize: number,
  options: RenderScriptureOptions,
  state: RenderState,
  key: string,
): ReactNode[] {
  return segments.map((segment, index) => {
    const segKey = `${key}.v${index}`
    // `verseNum` is a const, so TS keeps the `!= null` narrowing inside the closure.
    // It may be carried in from a prior block (poetry/continuation), so the footnote
    // marker resolves the *whole* verse from the map, not just this block's slice.
    const verseNum = segment.verse
    const verseContext = verseNum != null ? state.verseMap.get(verseNum) : undefined
    const inner = renderInlineNodes(segment.nodes, ctx, parentFontSize, verseContext, options, segKey)
    const onPress =
      verseNum != null && options.onVersePress
        ? () => options.onVersePress?.(verseNum)
        : undefined
    return (
      <Text key={segKey} onPress={onPress}>
        {inner}
      </Text>
    )
  })
}

// Native super/subscript baseline shift (fraction of font size; + = up). Distinct from
// the RN `Superscript` translateY values — the native path shifts the attributed-string
// baseline directly. Tune on device alongside SCRIPT_SCALE.
const NATIVE_SUPERSCRIPT_RISE_EM = 0.35
const NATIVE_SUBSCRIPT_DROP_EM = -0.15

type RunStyle = { bold: boolean; italic: boolean; smallCaps: boolean; color?: string; fontSize: number }

/** Compose a node's character-style classes onto the inherited run style. */
function mergeRunStyle(base: RunStyle, classes: string[], ctx: ScriptureStyleContext): RunStyle {
  let { bold, italic, smallCaps, color } = base
  let fontSizeEm = 1
  for (const cls of classes) {
    const spec = INLINE_STYLES[cls]
    if (!spec) continue
    if (spec.bold) bold = true
    if (spec.italic) italic = true
    if (spec.smallCaps) smallCaps = true
    if (spec.fontSizeEm) fontSizeEm *= spec.fontSizeEm
    if (spec.color === 'red') color = ctx.palette.red
    if (spec.color === 'muted') color = ctx.palette.mutedForeground
  }
  return { bold, italic, smallCaps, color, fontSize: base.fontSize * fontSizeEm }
}

function textRun(text: string, style: RunStyle, ctx: ScriptureStyleContext): ScriptureRun {
  return {
    text,
    fontSize: style.fontSize,
    fontFamily: resolveBodyFontFamily(ctx.fontFamily, { bold: style.bold, italic: style.italic }),
    color: style.color ?? ctx.palette.foreground,
    bold: style.bold,
    italic: style.italic,
    smallCaps: style.smallCaps,
  }
}

/**
 * Flatten a block's inline nodes to styled runs for the native hanging paragraph.
 * Mirrors `renderInlineNodes`, but composes ancestor styles into each run (an attributed
 * string has no nested `<Text>` to inherit through). Footnote markers become an empty
 * `footnote` run (native draws the note-bubble icon) and their drawer payloads are
 * collected into `footnotes`, with the index carried on the run — so footnote-bearing
 * poetry/list lines hang natively too, matching the web SDK (no uniform-indent bail).
 */
function serializeRuns(
  nodes: ScriptureNode[],
  ctx: ScriptureStyleContext,
  style: RunStyle,
  verse: VerseContext | undefined,
  footnotes: ScriptureFootnote[],
): ScriptureRun[] {
  const out: ScriptureRun[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.text.length > 0) out.push(textRun(node.text, style, ctx))
      continue
    }
    if (node.tag === 'br') {
      out.push(textRun('\n', style, ctx))
      continue
    }
    if (isFootnote(node)) {
      const footnoteIndex = footnotes.length
      footnotes.push(buildFootnote(node, verse))
      // Empty marker run; native draws the note-bubble icon and reports this index on tap.
      out.push({
        text: '',
        fontSize: style.fontSize,
        color: ctx.palette.footnoteMarker,
        footnote: true,
        footnoteIndex,
      })
      continue
    }
    if (hasClass(node, 'yv-vlbl')) {
      const label = textContent(node).trim()
      if (label.length > 0) {
        // Verse number: sans label font, muted, scaled + raised like the RN superscript.
        out.push({
          text: label,
          fontSize: style.fontSize * SCRIPT_SCALE,
          fontFamily: resolveLabelFontFamily(),
          color: ctx.palette.mutedForeground,
          baselineShiftEm: NATIVE_SUPERSCRIPT_RISE_EM,
        })
        out.push(textRun(' ', style, ctx)) // full-size separator after the number
      }
      continue
    }
    if (node.classes.some((cls) => SUPERSCRIPT_CLASSES.has(cls))) {
      out.push({
        ...textRun(textContent(node), style, ctx),
        fontSize: style.fontSize * SCRIPT_SCALE,
        baselineShiftEm: NATIVE_SUPERSCRIPT_RISE_EM,
      })
      continue
    }
    if (node.classes.some((cls) => SUBSCRIPT_CLASSES.has(cls))) {
      out.push({
        ...textRun(textContent(node), style, ctx),
        fontSize: style.fontSize * SCRIPT_SCALE,
        baselineShiftEm: NATIVE_SUBSCRIPT_DROP_EM,
      })
      continue
    }
    out.push(...serializeRuns(node.children, ctx, mergeRunStyle(style, node.classes, ctx), verse, footnotes))
  }
  return out
}

/** Serialize a block's verse segments to styled runs + collected footnote payloads. */
function serializeBlock(
  segments: VerseSegment[],
  ctx: ScriptureStyleContext,
  parentFontSize: number,
  state: RenderState,
): { runs: ScriptureRun[]; footnotes: ScriptureFootnote[] } {
  const runs: ScriptureRun[] = []
  const footnotes: ScriptureFootnote[] = []
  const base: RunStyle = { bold: false, italic: false, smallCaps: false, fontSize: parentFontSize }
  for (const seg of segments) {
    const verse = seg.verse != null ? state.verseMap.get(seg.verse) : undefined
    runs.push(...serializeRuns(seg.nodes, ctx, base, verse, footnotes))
  }
  return { runs, footnotes }
}

function renderParagraph(
  node: ScriptureElementNode,
  ctx: ScriptureStyleContext,
  options: RenderScriptureOptions,
  state: RenderState,
  key: string,
): ReactNode {
  const spec = getBlockSpec(node.classes)
  const blockStyle = resolveBlockTextStyle(node.classes, ctx)
  const parentFontSize = blockStyle.fontSize ?? ctx.baseFontSize
  const segments = groupVerses(node.children, state.cursor.verse)

  // Native hanging indent (injected): the faithful first-line/wrapped hang via platform
  // paragraph styles (NSParagraphStyle / LeadingMarginSpan). Footnote-bearing lines hang
  // too (marker as a superscript letter), so nothing bails to the uniform fallback. Only
  // used when a native renderer is supplied; otherwise the RN approximation below runs.
  const HangingParagraph = options.renderHangingParagraph
  if (HangingParagraph && spec?.hangIndentEm) {
    const { runs, footnotes } = serializeBlock(segments, ctx, parentFontSize, state)
    state.cursor.verse = trailingVerse(segments, state.cursor.verse)
    const [firstEm, wrappedEm] = spec.hangIndentEm
    const verse = segments.find((seg) => seg.verse != null)?.verse
    const onVersePress =
      verse != null && options.onVersePress ? () => options.onVersePress?.(verse) : undefined
    const onFootnotePress = options.onFootnotePress
      ? (index: number) => {
          const footnote = footnotes[index]
          if (footnote) options.onFootnotePress?.(footnote)
        }
      : undefined
    return (
      <HangingParagraph
        key={key}
        runs={runs}
        firstIndent={parentFontSize * firstEm}
        restIndent={parentFontSize * wrappedEm}
        lineHeightMultiple={spec.lineHeightEm ?? ctx.lineHeightMultiplier}
        onVersePress={onVersePress}
        onFootnotePress={onFootnotePress}
      />
    )
  }

  // Emulate CSS first-line `text-indent` with leading em-spaces on the first line
  // only (wrapped lines are unaffected, which is the desired behaviour).
  const firstLineIndentEm = spec?.firstLineIndentEm ?? 0
  const firstLineIndent =
    firstLineIndentEm > 0 ? EM_SPACE.repeat(Math.max(1, Math.round(firstLineIndentEm))) : null

  const children = renderVerseSegments(segments, ctx, parentFontSize, options, state, key)

  state.cursor.verse = trailingVerse(segments, state.cursor.verse)

  return (
    <Text key={key} style={blockStyle}>
      {firstLineIndent}
      {children}
    </Text>
  )
}

function renderBlockNode(
  node: ScriptureNode,
  ctx: ScriptureStyleContext,
  options: RenderScriptureOptions,
  state: RenderState,
  key: string,
): ReactNode {
  if (node.type === 'text') {
    if (node.text.trim() === '') return null
    return (
      <Text key={key} style={resolveBlockTextStyle([], ctx)}>
        {node.text}
      </Text>
    )
  }

  if (isSpacer(node)) {
    return <View key={key} style={{ height: ctx.baseFontSize }} />
  }

  if (isContainer(node)) {
    return <View key={key}>{renderBlockNodes(node.children, ctx, options, state, key)}</View>
  }

  if (isParagraphBlock(node)) {
    return renderParagraph(node, ctx, options, state, key)
  }

  // Inline element sitting at block level — wrap so its text has a Text ancestor. It
  // belongs to the carried verse, so a marker here still resolves the whole verse.
  const verseContext =
    state.cursor.verse != null ? state.verseMap.get(state.cursor.verse) : undefined
  return (
    <Text key={key} style={resolveBlockTextStyle([], ctx)}>
      {renderInlineNodes(node.children, ctx, ctx.baseFontSize, verseContext, options, key)}
    </Text>
  )
}

function renderBlockNodes(
  nodes: ScriptureNode[],
  ctx: ScriptureStyleContext,
  options: RenderScriptureOptions,
  state: RenderState,
  keyPrefix: string,
): ReactNode[] {
  return nodes
    .map((node, index) => renderBlockNode(node, ctx, options, state, `${keyPrefix}.${index}`))
    .filter((el): el is ReactNode => el !== null)
}

/**
 * Render transformed-or-raw scripture HTML into a native React element tree. Pure
 * and Hermes-safe — no WebView, no DOM. The returned `<View>` lays out paragraph,
 * poetry, and heading blocks; verse runs and footnote markers are pressable.
 */
export function renderScriptureHtml(html: string, options: RenderScriptureOptions): ReactNode {
  const ctx = buildContext(options)
  const nodes = parseScriptureHtml(html)
  const state: RenderState = { verseMap: buildVerseContextMap(nodes, options), cursor: {} }
  return <View>{renderBlockNodes(nodes, ctx, options, state, 'root')}</View>
}

/**
 * Render a footnote's inner HTML (USFM footnote character styles `fr`/`ft`/`fq`/…)
 * into inline runs, reusing the same inline renderer the reader body uses so a note
 * matches reader styling — no WebView. Footnotes carry no nested verses or markers,
 * so no press handlers are wired. Returns inline children for a `<Text>` ancestor
 * (the footnote drawer wraps them). Used by `ScriptureFootnoteSheet`.
 */
export function renderFootnoteHtml(html: string, options: RenderScriptureOptions): ReactNode[] {
  const ctx = buildContext(options)
  const nodes = parseScriptureHtml(html)
  return renderInlineNodes(nodes, ctx, ctx.baseFontSize, undefined, { theme: options.theme }, 'fn')
}

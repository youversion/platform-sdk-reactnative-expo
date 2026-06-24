import { NodeType, parse } from 'node-html-parser'
import type { HTMLElement as ParsedElement, Node as ParsedNode } from 'node-html-parser'

import type { ScriptureElementAttrs, ScriptureNode } from './types'

/**
 * USFM marker classes the Web SDK's `bible-reader.css` hides with
 * `display: none` (metadata, navigation, chapter labels, cross-references). We
 * drop them at parse time so the renderer never has to know about them.
 *
 * `.label` is the chapter number (verse numbers come through as `.yv-vlbl`).
 * `.x` is a cross-reference note (hidden by the SDK reader too). Note: `.yv-n`
 * (footnotes) is intentionally **not** hidden — the SDK reader hides the raw
 * `.yv-n` and surfaces footnotes only after `transformBibleHtml`, but we render
 * directly from raw API HTML, so the renderer turns `.yv-n.f` into a pressable
 * footnote marker itself (see `scripture-renderer`).
 */
const HIDDEN_CLASSES = new Set([
  'id',
  'ide',
  'usfm',
  'h',
  'sts',
  'rem',
  'toc1',
  'toc2',
  'toc3',
  'toca1',
  'toca2',
  'toca3',
  'ie',
  'mte',
  'cl',
  'label',
  'x',
])

/** Collapse HTML insignificant whitespace runs to a single space. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ')
}

function readAttrs(el: ParsedElement): ScriptureElementAttrs {
  const attrs: ScriptureElementAttrs = {}
  const verseNumber = el.getAttribute('v')
  if (verseNumber != null) attrs.verseNumber = verseNumber
  const footnoteKey = el.getAttribute('data-verse-footnote')
  if (footnoteKey != null) attrs.footnoteKey = footnoteKey
  const footnoteContent = el.getAttribute('data-verse-footnote-content')
  if (footnoteContent != null) attrs.footnoteContent = footnoteContent
  const dir = el.getAttribute('dir')
  if (dir != null) attrs.dir = dir
  const colSpan = el.getAttribute('colspan')
  if (colSpan != null) attrs.colSpan = colSpan
  return attrs
}

function mapNode(node: ParsedNode): ScriptureNode | null {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = collapseWhitespace(node.text)
    // Keep meaningful single spaces (e.g. the space the transformer inserts
    // before a footnote anchor); only drop genuinely empty nodes.
    return text.length > 0 ? { type: 'text', text } : null
  }

  if (node.nodeType !== NodeType.ELEMENT_NODE) return null // comments

  const el = node as ParsedElement
  const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
  if (classes.some((cls) => HIDDEN_CLASSES.has(cls))) return null

  const attrs = readAttrs(el)
  // Raw `.yv-n` footnotes carry their note as child elements (no
  // `data-verse-footnote-content` attribute). Capture the inner HTML so the
  // renderer can surface rich footnote content (fr/ft/fq spans) for the raw API
  // shape too, matching the transformed shape. The footnote drawer re-parses it.
  if (attrs.footnoteContent == null && classes.includes('yv-n')) {
    attrs.footnoteContent = el.innerHTML
  }

  return {
    type: 'element',
    tag: el.tagName ? el.tagName.toLowerCase() : '',
    classes,
    attrs,
    children: mapChildren(el),
  }
}

function mapChildren(el: ParsedElement): ScriptureNode[] {
  const out: ScriptureNode[] = []
  for (const child of el.childNodes) {
    const mapped = mapNode(child)
    if (mapped) out.push(mapped)
  }
  return out
}

/**
 * Parse transformed scripture HTML into a {@link ScriptureNode} tree. Pure and
 * Hermes-safe — `node-html-parser` is plain JS with no DOM or Node built-in
 * dependencies, so this runs on a device with no WebView.
 */
export function parseScriptureHtml(html: string): ScriptureNode[] {
  const root = parse(html ?? '')
  return mapChildren(root)
}

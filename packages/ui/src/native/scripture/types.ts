/**
 * Minimal, serializable AST produced by {@link parseScriptureHtml} and consumed
 * by the native scripture renderer. It is intentionally decoupled from
 * `node-html-parser` so the renderer never touches a DOM-like node and layer-1
 * tests can assert on plain objects.
 *
 * The input HTML may be either the **raw** API shape (empty
 * `<span class="yv-v" v="N">` start markers + `<span class="yv-vlbl">N</span>`
 * labels + sibling verse text) or the **transformed** self-contained shape from
 * `@youversion/platform-core`'s `transformBibleHtml` (verse content wrapped in
 * `.yv-v[v]`, footnotes as `[data-verse-footnote]` anchors). The parser is
 * shape-agnostic — it never extracts footnotes or wraps verses; the renderer
 * groups verses from markers at render time.
 */

export type ScriptureTextNode = {
  type: 'text'
  text: string
}

export type ScriptureElementAttrs = {
  /** Verse number from a `.yv-v[v]` wrapper. */
  verseNumber?: string
  /** Footnote key from `data-verse-footnote` (verse number or `intro-N`). */
  footnoteKey?: string
  /** Raw inner HTML of the footnote from `data-verse-footnote-content`. */
  footnoteContent?: string
  /** `dir="rtl"` passthrough for RTL passages. */
  dir?: string
  /** Table cell span. */
  colSpan?: string
}

export type ScriptureElementNode = {
  type: 'element'
  /** Lowercased tag name, e.g. `div`, `span`, `table`. */
  tag: string
  /** Space-separated `class` tokens (USFM markers like `p`, `q1`, `wj`). */
  classes: string[]
  attrs: ScriptureElementAttrs
  children: ScriptureNode[]
}

export type ScriptureNode = ScriptureTextNode | ScriptureElementNode

# Native (non-WebView) scripture rendering

> Status: **spike / experimental** (branch `YPE-3169`). Ships behind the new
> `ScriptureTextView` export; the WebView `BibleReader`/`BibleTextView` remain the
> supported path. This ADR records the route investigated, not a migration.

## The problem

Every Bible surface renders the Web SDK HTML inside an Expo DOM Component (a
WebView) — see [`0001`](0001-reuse-web-sdk-content-with-native-presentation.md).
That path carries recurring WebView pain: the Android `@expo/dom-webview`
null-`localStorage` blank-render (`lib/dom-local-storage.ts`), Fabric codegen
blanks (`buildFromSource`), release-build blanks, the iOS injection-quote bug
([`0009`](0009-bridge-safe-font-tokens.md)), and WebView cold-start. This spike
asks whether the **reading surface** can be rendered natively instead, removing
the WebView (and its failure modes) for scripture.

## The decision

Render scripture **natively** from the YouVersion API's HTML, mapping its USFM
CSS classes to React Native styles. No WebView, no DOM, no `transformBibleHtml`.

- **Parser** — `node-html-parser` (pure JS, Hermes-safe) parses the HTML into a
  small `ScriptureNode` AST (`native/scripture/parse-scripture-html.ts`). The Web
  SDK's own parse path is browser-bound (`isomorphic-dompurify` +
  `dangerouslySetInnerHTML` + `document.createTreeWalker` in
  `platform-core/bible-html-transformer.ts`), none of which exist in Hermes, so
  it cannot be lifted; we reuse the _algorithm's intent_, not the runtime.
- **Curated style map** — `native/scripture/scripture-class-styles.ts` translates
  `platform-core/src/styles/bible-reader.css` (the complete USFM catalog) and the
  `theme.css` color tokens **verbatim** into `BLOCK_STYLES` / `INLINE_STYLES`.
  Em-based CSS values are kept as multipliers and resolved against the reader's
  base font size so size changes cascade like the web reader.
- **Renderer** — `native/scripture/scripture-renderer.tsx` walks the AST to nested
  `<Text>`/`<View>`. The load-bearing RN fact: **nested `<Text>` flows mixed-style
  inline runs**, which is exactly a scripture paragraph. Verses are grouped at
  render time from `.yv-v[v]` boundaries (empty marker = raw start; populated =
  transformed wrapper) into pressable runs; footnotes are surfaced from `.yv-n.f`
  (raw) or `[data-verse-footnote]` (transformed) as pressable markers.
- **Footnote drawer** — tapping a marker opens a **fully native** drawer
  (`native/scripture/scripture-footnote-sheet.tsx`), the non-WebView analog of the
  DOM `FootnoteContent` sheet, mirroring its layout: the **verse reference**, the
  **verse text** (with a superscript letter at each note's position), then the
  verse's **notes** listed below (each prefixed with its matching `a`/`b`/… letter,
  wrapping at `z`). The reference is the human passage reference (`passage.reference`,
  e.g. `Acts 15`) + `:verse` → `Acts 15:2`, falling back to `usfm.verse` then
  `Verse N` when no reference is available (offline `html` path). The renderer
  threads this verse context to each marker (verse tokens + lettered notes,
  mirroring the Web SDK's `getVerseHtmlFromDom` which swaps anchors for `<sup>`
  letters), so a tapped note surfaces every note in its verse, not just itself. It
  reuses the shared `NativeSheet` (a `@gorhom/bottom-sheet`, not a WebView) and
  renders each note **richly** via `renderFootnoteHtml`, which runs the note's
  inner HTML back through the same inline renderer so USFM footnote character
  styles (`fr` reference, `ft` text, `fq`/`fqa` quotes) match reader styling —
  keeping the whole reading surface WebView-free. Both footnote shapes feed it: the
  transformed shape supplies the note as `data-verse-footnote-content`, and for the
  raw `.yv-n` shape the parser captures the footnote's inner HTML as
  `footnoteContent`. The drawer is **internal** — `ScriptureTextView` always owns
  it; footnote handling is not a consumer-facing prop or export.
- **Data** — `ScriptureTextView` fetches via `usePassage` from
  `@youversion/platform-react-hooks` (`passage.content` is raw HTML). The hooks
  `YouVersionProvider` is mounted natively with a **resolved** theme (never
  `'system'`, which would hit `window.matchMedia`) and the RN `x-yvp-sdk` header.
  This is the first web-SDK React provider mounted in the native tree; it is
  renderer-agnostic context + `fetch` (no react-dom) and its
  `YouVersionPlatformConfiguration` writes are idempotent with core's.

Because the API HTML renders directly, **no transform and no browser DOM is
needed anywhere** on the native path, even with notes enabled.

## Alternatives rejected

- **`react-native-render-html`** — heavyweight, maintenance-stalled general CSS
  engine; its `classesStyles` maps poorly onto nested USFM semantics and it fights
  verse/footnote press wiring. We want a thin tree we fully control.
- **Shim the DOM** (`document`/`TreeWalker`/jsdom) to run the SDK's transformer
  verbatim — recreates the WebView dependency we are removing; DOMPurify alone
  needs broad DOM surface.
- **Pre-transform to `[data-verse-footnote]` HTML** before rendering — needs a DOM
  on native. Unnecessary: the renderer handles raw `.yv-n.f` directly.

## Known RN fidelity gaps

- **text-indent / hanging indent** — RN `<Text>` has none. Prose first-line indent
  (`.p`/`.pi`/`.po`, positive `text-indent`) is emulated with a leading em-space (first
  line only). Poetry/list **hanging** indent (CSS `padding-inline-start` + **negative**
  `text-indent`) is **not reproduced**; the renderer applies the net first-line position
  as a uniform `paddingLeft` (`q1` flush, `q2`/`q3` +1em, `q4` +2em; lists at the SDK
  `padding-inline-start`), so single-line verses staircase correctly but wrapped lines do
  not hang. Four approaches were tried and abandoned:
  (1) a per-word `flexWrap` row — the negative-margin pull was clamped by Yoga and
  isolating words broke superscript baselines and small-caps/colour inheritance;
  (2) `onTextLayout` line-text word-counting — per-line `text` is empty under the new
  architecture; (3) a binary-search on `lines.length` via a hidden measuring `<Text>` —
  `onTextLayout` produced no usable line data on the Fabric dev build;
  (4) a **flex-row gutter** (verse number in a fixed `width = wrapped − first` gutter,
  verse text in a `flex:1` column) — **device-tested and rejected:** it produces a
  *label + block* layout, not a hang. Because the text column has a single left edge, the
  **whole verse** (including the first line) sits at the wrapped-line position with a gap
  after the number — the opposite of a hanging indent, where the first line is *less*
  indented than the wrapped lines. Flowing verse text must continue on the first line
  immediately after the number (at `first`) and only *wrapped* lines indent to `wrapped`;
  that is precisely the negative first-line indent RN cannot express on a single `<Text>`.
  This rules out a pure-RN solution: the platforms expose the capability natively
  (`NSParagraphStyle.firstLineHeadIndent`/Android `LeadingMarginSpan`) but RN does not
  surface it, so **a native paragraph-style module is the only faithful fix** — scoped in
  [`0011`](0011-native-paragraph-style-module-for-hanging-indent.md).
- **super/subscript** — RN has no inline `vertical-align`/OpenType `sups`, and `transform`
  is ignored on a *nested* `<Text>` (merged into the parent's attributed string). We instead
  render an **inline `<View>`** (a real view) inside the flowing `<Text>` and raise/lower it
  with `transform: translateY`; the inner `<Text>` keeps the **real characters**, so it works
  for any numeral system/script (i18n-safe, unlike Unicode glyph substitution). Used for verse
  numbers and `.sup`/`.sub`/`.ord`/`.vp`/`.fv`. Because the shift wraps the run in a real
  `<View>`, RN text inheritance does **not** cross into the inner `<Text>`: the reader font
  (whose metrics the rise is tuned against) and the themed foreground colour must be threaded
  in explicitly, or the glyph falls back to the system font (dropped baseline) and black
  (invisible in dark mode). The renderer now passes both for body super/subscripts, matching the
  verse-label and footnote-drawer paths. Inline views in text remain platform-sensitive
  (baseline alignment, line-height) — verify on **iOS and Android** and tune
  `SUPERSCRIPT_RISE_EM`/`SCRIPT_SCALE`.
- **footnote marker** — rendered as the Web SDK's note-bubble icon (the same 24×24
  `Footnote` SVG path, via `react-native-svg`) rather than a placeholder glyph, so
  markers match the web reader. Like the super/subscript shift it flows as an inline
  `<View>` in the verse `<Text>` (the SVG owns the press target), so its vertical
  placement is platform-sensitive — tune `FOOTNOTE_ICON_EM`/`FOOTNOTE_ICON_DROP_EM`
  on device. `react-native-svg` is already a peer dep.
- **small-caps (`nd`/`sc`)** — `fontVariant: ['small-caps']` is iOS-only / Android-
  spotty.
- **fonts** — full parity needs Source Serif 4 + Inter registered via `expo-font`
  (the example app loads them via `@expo-google-fonts/*`); unloaded variants fall
  back to the system font.

## Verification

- Layer-1: `parse-scripture-html` (raw Acts 15 + transformed-footnote fixtures) and
  `scripture-class-styles` (class → style, light/dark, font cascade).
- Layer-3: `renderScriptureHtml` renders verse text, verse press → `onVersePress`,
  and footnote markers carry verse context (reference, verse text, all notes);
  `ScriptureTextView` marker press opens the built-in native drawer showing that
  context (`native/scripture/__tests__/`).
- Bundle: `apps/example` exports cleanly for iOS via Metro (hooks package,
  `node-html-parser`, fonts all resolve in Hermes).
- Device (manual, remaining): the example "Native" tab fetches Acts 15 live and
  renders it; compare against the WebView reader on iOS **and** Android — Android
  is the priority, being where the WebView blanks this is meant to eliminate.

# Native paragraph-style module for hanging indent (scope)

> Status: **implemented & device-verified on iOS.** Follow-up to
> [`0010`](0010-native-scripture-rendering-spike.md). Every pure-RN avenue is exhausted
> (four attempts, see 0010 — including a flex-row gutter that device-tested as a *label +
> block* layout, not a hang), so this native module is the only faithful fix.
>
> - **Native module** — a bundled Expo module shipped **inside `packages/ui`**
>   (`ios/`, `android/`, `expo-module.config.json`; Swift + Kotlin), registered as
>   `YouVersionScriptureParagraph`. It receives serialized styled runs +
>   `firstIndent`/`restIndent` and applies the hang via
>   `NSParagraphStyle.firstLineHeadIndent`/`headIndent` (iOS) and
>   `LeadingMarginSpan.Standard(first, rest)` (Android). Self-measures its height back to
>   RN (native text has no intrinsic Yoga size). It **autolinks** when the package is
>   installed, so consumers author no native module of their own. It ships source (podspec
>   `source_files`, gradle build-from-source), so there is no prebuilt-AAR/`buildFromSource`
>   codegen risk. (The spike originally built it as a local module under
>   `apps/example/modules/` for the fastest device loop; it now lives in the SDK as planned.)
> - **Injection** — `ScriptureTextView` uses the bundled `ScriptureParagraph` view as the
>   **default** `renderHangingParagraph` on native (web has no native view → the renderer's
>   RN approximation); the renderer serializes `.q*`/`.li*` blocks to runs and routes them
>   through it. The `renderHangingParagraph` prop remains as a consumer override.
> - **Footnotes** — footnote-bearing lines hang too; the marker is the web SDK's note-bubble
>   icon (the same 24×24 path, drawn into an inline `NSTextAttachment`) and is **tappable**,
>   opening the existing drawer. Verse + footnote taps share one tap gesture.
>
> ### The hard-won lesson: the footnote-tap "reader shift"
>
> Once the bubble was tappable, tapping a footnote made the whole reader **shift down a few
> px** (and stay). It took a long bisection to find: it was **not** the React re-render
> (memoized), **not** the reported height (latched), **not** content inset/offset, and
> **not** the sheet opening (it shifted with the sheet disabled). The cause: `handleTap`
> called `layoutManager.characterIndex(for:in:…)` for hit-testing, and **querying the live
> layout manager re-ensures layout**, which with a line-height multiple repositions the
> glyphs — invisible to RN (no frame change, no `onLayout`, no re-render). **Fix:** compute
> each footnote marker's hit rect **once during the measure pass** (when layout is already
> being done) and cache it; `handleTap` reads the cache and never touches the layout manager.
> No query on tap → no re-layout → no shift. The decisive diagnostics were RN `onLayout`
> (proved the frame was stable) and a JS-only "disable the sheet" test (proved the tap, not
> the sheet, was the trigger).
>
> **Defensive code from that bisection still in the view** (each independently sensible, but
> none was the actual fix; candidates for cleanup): a measure-once latch, a `sizeThatFits`
> cache, `contentInsetAdjustmentBehavior = .never`, and a non-scrolling `PinnedTextView`.
> The descender `textContainerInset.bottom` **is** load-bearing — it fixes real descender
> clipping. The measure-once latch's known cost: the view won't reflow on a width change
> (rotation) without a content change.
>
> **Remaining = device:** confirm on **Android** (the iOS path is verified); tune
> `NATIVE_SUPERSCRIPT_RISE_EM`/`SCRIPT_SCALE`/`FOOTNOTE_ICON_*`; verify `ReactFontManager`
> resolves the custom fonts on Android.

## The problem

USFM poetry (`.q*`/`.qm*`) and list (`.li*`/`.lim*`) lines use a **hanging indent**:
the first line sits flush (or shallow) and *wrapped* lines indent further. The Web
SDK CSS expresses this with `padding-inline-start` (the wrapped-line position) plus a
**negative** `text-indent` (pulls the first line left):

| class      | `padding-inline-start` | `text-indent` | first line | wrapped lines |
|------------|------------------------|---------------|-----------:|--------------:|
| `q`/`q1`   | 2em                    | −2em          | **0em**    | **2em**       |
| `q2`       | 2em                    | −1em          | 1em        | 2em           |
| `q3`       | 3em                    | −2em          | 1em        | 3em           |
| `q4`       | 4em                    | −2em          | 2em        | 4em           |
| `qm`/`qm1` | 2em                    | −2em          | 0em        | 2em           |
| `qm2`      | 2em                    | −1em          | 1em        | 2em           |
| `qm3`      | 3em                    | −2em          | 1em        | 3em           |
| `qm4`      | 4em                    | −2em          | 2em        | 4em           |
| `li`/`li1` | 2em                    | −1.5em        | 0.5em      | 2em           |
| `li2`      | 3em                    | −1.5em        | 1.5em      | 3em           |
| `li3`      | 4em                    | −1.5em        | 2.5em      | 4em           |
| `li4`      | 5em                    | −1.5em        | 3.5em      | 5em           |
| `lim`/`lim1`| 3em                   | −1.5em        | 1.5em      | 3em           |
| `lim2`     | 4em                    | −1.5em        | 2.5em      | 4em           |
| `lim3`     | 5em                    | −1.5em        | 3.5em      | 5em           |

(The introduction variants `ili*`/`iq*` share the same shape and are in scope too.)
Classes with **positive** `text-indent` (prose `.p`/`.pi`/`.ip` first-line indent)
are **out of scope** — they need no hang and are already emulated with a leading
em-space (`renderParagraph` in `scripture-renderer.tsx`).

### Why RN can't do it (recap from 0010)

RN `<Text>` style has no `text-indent`, no `firstLineHeadIndent`, no leading-margin.
The three JS approximations all failed under Fabric (per-word `flexWrap` row clamped
by Yoga + broke baselines; `onTextLayout` line text empty under the new architecture;
hidden-`<Text>` line-count binary search never resolved). Today the renderer collapses
the hang to a **uniform `paddingLeft`** (`scripture-class-styles.ts`), so single-line
poetry staircases correctly but wrapped lines do not hang. Both platforms expose the
capability natively — iOS `NSParagraphStyle.firstLineHeadIndent`/`headIndent`, Android
`LeadingMarginSpan.Standard(first, rest)` — but only as attributes on a native
attributed string, which RN never surfaces.

## The core constraint

A paragraph style (`firstLineHeadIndent`/`LeadingMarginSpan`) can only be set on the
**native attributed string** that backs the text. RN builds that string from a `<Text>`
tree and exposes no hook to add paragraph attributes. So any faithful fix must own the
paragraph's text layout natively — which collides with how the renderer composes a
scripture paragraph today: a parent `<Text>` containing **nested `<Text>` runs and
inline `<View>`s** (baseline-shifted verse numbers, the footnote-bubble SVG, WJ red,
small-caps), with `onPress` wired on verse runs and footnote markers. A native text
view that owns layout must reproduce all of that — inline attachments, theming, fonts,
and hit-tested press callbacks — or lose it.

## Options

### A. Full native rich-paragraph component (faithful)

A Fabric view (`<ScriptureParagraph>`) shipped as a local Expo module in `packages/ui`
(Swift + Kotlin + `expo-module.config.json`, autolinked in consumer apps). It receives
the paragraph as a **serialized run list** — `{text, bold, italic, color, fontFamily,
fontSize}` plus inline-attachment descriptors (`{kind: 'superscript'|'footnote',
…runId}`) — and the per-class `(firstIndentEm, restIndentEm)` pair, then builds the
platform attributed string and applies the paragraph style:

- **iOS** — `NSMutableAttributedString`; `NSParagraphStyle.firstLineHeadIndent` +
  `headIndent`; inline content as `NSTextAttachment` (custom subclass for the SVG
  marker / superscript view); taps via a `UITextView`/layout-manager character hit-test
  emitting `onRunPress(runId)`.
- **Android** — `SpannableStringBuilder`; `LeadingMarginSpan.Standard(first, rest)`;
  inline content as `ReplacementSpan`/`ImageSpan`; taps via `ClickableSpan` →
  `onRunPress(runId)`.

`scripture-renderer.tsx` would, for in-scope block classes, emit `<ScriptureParagraph>`
with the serialized runs instead of the `<Text>` tree, mapping `onRunPress` back to the
existing `onVersePress`/footnote-drawer handlers.

- **Pros** — pixel-faithful hang on both platforms; correct for wrapped lines.
- **Cons** — effectively **re-implements the paragraph renderer natively**: a run
  serialization protocol, two platform text engines, inline attachments, font/theme
  resolution mirrored native-side, and press hit-testing — all duplicating logic the JS
  renderer already owns. Two native codebases to maintain + Fabric codegen. It
  **reintroduces the native-build surface** (codegen/autolinking) that 0010/0008's
  `buildFromSource` and Fabric-registration blanks came from — smaller and fully under
  our control, but the same class of risk. High effort, high risk.

### B. Narrow text-only hang shim (hybrid)

A minimal native component that renders **plain text** with the paragraph style, used
only for paragraphs with no inline attachments; fall back to today's uniform
`paddingLeft` when a paragraph contains inline `<View>`s.

- **Cons** — the first line of a verse's poetry block carries the inline-`<View>` verse
  number, so the highest-value lines (verse starts) fall back anyway. Continuation lines
  (`q2`…) are plain text and would hang, but the result is **inconsistent** (some lines
  hang, some don't) for marginal benefit and still two-platform native. Not worth it.

### C. Defer; keep the approximation (status quo)

Keep the uniform-`paddingLeft` approximation, optionally improved (below). Document the
gap. No native module.

- **Pros** — zero native surface, preserves the spike's "thin JS tree we control"
  thesis and its WebView-removal win without trading it for our own native code.
- **Cons** — wrapped poetry/list lines don't hang. In practice the visible defect is
  **narrow**: poetry lines are short and on a phone many `.q*` lines fit on one line
  (where the staircase already works); the gap mainly shows on long `.li*` items and
  wrapped long poetic lines.

### Interim, no native code (independent of the choice above)

Today `scripture-class-styles.ts` sets `paddingLeftEm` to the **first-line** net
position (`q1` 0, `q2`/`q3` 1, `q4` 2). The table above shows the **wrapped-line**
positions are larger (`q1` 2, `q3` 3, `q4` 4). Since wrapping is exactly the multi-line
case, switching the uniform indent to the **wrapped-line** value (and dropping the
first line via the existing positive-`text-indent` em-space path, inverted) would make
long wrapped lines read correctly at the cost of pushing single-line verse starts right.
This is a fidelity trade, not a fix — worth a device A/B before committing.

## Recommendation

The cheap pure-RN alternatives are exhausted (0010, four attempts). The decision is now
binary: **keep the uniform-`paddingLeft` approximation** (zero native surface; correct
for single-line poetry/lists, wrong only when a line wraps — narrow on phone widths), **or
build Option A** (faithful, but ~8 days, two platforms, and reintroduces the native-build/
codegen surface the spike set out to shed). Recommend keeping the approximation **unless**
the pending device review judges wrapped poetry/list hangs a launch blocker. If it does,
build Option A as a self-contained local Expo module in `packages/ui`, scoped strictly to
the negative-`text-indent` classes in the table, with the run-serialization protocol and
`onRunPress` contract above.

## If we build it — concrete scope (Option A)

- **Package** — local Expo module inside `packages/ui` (`ios/`, `android/`,
  `expo-module.config.json`); autolinks in consumer dev builds (already required —
  Expo Go unsupported). Add `buildFromSource` for the Android module name, matching the
  `@expo/dom-webview` precedent in 0008, so clean/CI builds match app codegen.
- **JS surface** — `requireNativeView('YouVersionScriptureParagraph')` wrapped by a typed
  `<ScriptureParagraph runs={Run[]} firstIndent={number} restIndent={number}
  onRunPress={(runId) => void} …>`; `Run` mirrors the inline style fields
  `resolveInlineTextStyle` already produces, so the JS renderer serializes rather than
  recomputes.
- **Renderer integration** — in `renderParagraph`, branch in-scope block classes to
  `<ScriptureParagraph>` with `(firstIndent, restIndent)` from a new field on
  `BlockStyleSpec` (e.g. `hangIndentEm: [first, rest]`), resolved against `baseFontSize`;
  all other blocks keep the current `<Text>` path. Map `onRunPress` to existing
  `onVersePress` / footnote-drawer handlers by run id.
- **Testing** — layer 1: the `(first, rest)` em table → px resolution and run
  serialization (pure, no native). Layer 3: renderer emits `<ScriptureParagraph>` (mocked
  as a native primitive) for `.q*`/`.li*` and `<Text>` otherwise, and `onRunPress`
  dispatches to the right handler. Device: the only place the actual hang is verifiable —
  fold into 0010's pending iOS+Android device pass (Psalm 23 poetry, a list passage).
- **Risks** — inline attachment baseline alignment differs per platform (same family as
  0010's superscript/footnote-marker tuning); `ClickableSpan`/`UITextView` hit-testing for
  press targets; Fabric codegen drift on clean builds (mitigated by `buildFromSource`);
  added Swift/Kotlin maintenance on a previously JS-only package.

## Effort

Rough order of magnitude (not a commitment): the JS side (protocol, renderer branch,
layer-1/3 tests) is small; the two native text implementations with inline attachments
and press hit-testing are the bulk, plus device tuning. It is a multi-day,
two-platform native task — materially larger than any change in 0010, which is the
central reason to defer unless device testing proves it necessary.

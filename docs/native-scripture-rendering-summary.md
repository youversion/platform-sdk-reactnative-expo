# Native (WebView-free) scripture rendering — change & verification summary

**PR companion doc.** Synthesizes the work recorded in
[ADR 0010](adr/0010-native-scripture-rendering-spike.md) (the native rendering spike) and
[ADR 0011](adr/0011-native-paragraph-style-module-for-hanging-indent.md) (the native
hanging-indent module), plus the verification we ran. Read the ADRs for the full
rationale and rejected alternatives; this doc is the "what we built, how it works, and
what we tested" overview for reviewers.

## Why

Every Bible surface today renders Web SDK HTML inside an Expo DOM Component (a WebView).
That path keeps producing WebView-specific failures: the Android `@expo/dom-webview`
null-`localStorage` blank render, Fabric codegen blanks (`buildFromSource`), release-build
blanks, the iOS injection-quote bug, and WebView cold-start latency. This effort asks
whether the **reading surface** can be rendered **natively** instead — no WebView, no DOM,
no `transformBibleHtml` — eliminating that whole failure class for scripture.

The result is a new, opt-in `ScriptureTextView` export. The WebView `BibleReader` /
`BibleTextView` remain the supported path; this is an additive native route.

## What we built — the pipeline

Raw API HTML → native React tree, entirely in Hermes (no WebView, no browser DOM). All
files live in `packages/ui/src/native/scripture/`.

```
usePassage() ──HTML──▶ parseScriptureHtml ──AST──▶ renderScriptureHtml ──▶ <View>/<Text> tree
 (hooks pkg)          (node-html-parser)          (curated USFM→RN map)      │
                                                                            ├─ verse runs (pressable)
                                                                            ├─ verse numbers / super-sub (baseline-shift)
                                                                            ├─ footnote markers (SVG bubble, pressable)
                                                                            ├─ poetry/list → native hanging-indent module
                                                                            └─ tap marker → native footnote drawer
```

| Layer            | File                                                                                 | Role                                                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parser           | `parse-scripture-html.ts`                                                            | `node-html-parser` (pure JS) → minimal serializable `ScriptureNode` AST. Drops SDK-hidden USFM classes (metadata, chapter labels, cross-refs); shape-agnostic across raw `.yv-n` and transformed `[data-verse-footnote]` HTML.                                                                                  |
| Style map        | `scripture-class-styles.ts`                                                          | USFM CSS class → RN style, translated **verbatim** from `platform-core`'s `bible-reader.css`. Em values kept as multipliers, resolved against the reader's base size so font-size changes cascade like the web. Split into `BLOCK_STYLES` / `INLINE_STYLES`.                                                    |
| Theme            | `scripture-theme.ts`                                                                 | `--yv-*` light/dark color tokens resolved to hex (native can't inherit CSS custom properties).                                                                                                                                                                                                                  |
| Fonts            | `scripture-fonts.ts`                                                                 | Maps the web font stacks to registered `@expo-google-fonts/*` family names per weight/style (RN has no synthetic bold/italic for custom families).                                                                                                                                                              |
| Renderer         | `scripture-renderer.tsx`                                                             | Walks the AST to nested `<Text>`/`<View>`. Groups verses at render time from `.yv-v[v]` boundaries into pressable runs; surfaces footnotes from either HTML shape; threads each verse's full context (across block boundaries) to its markers.                                                                  |
| Super/subscript  | `baseline-shift.tsx`                                                                 | Inline `<View>` + `translateY` (RN ignores `transform` on nested `<Text>`). Keeps the **real characters**, so it's i18n-safe across all numeral systems. Used for verse numbers and `.sup`/`.sub`/`.ord`/`.vp`/`.fv`.                                                                                           |
| Footnote marker  | `scripture-footnote-icon.tsx`                                                        | The web SDK's exact 24×24 note-bubble SVG (`react-native-svg`), flowing inline and owning its press target.                                                                                                                                                                                                     |
| Footnote drawer  | `scripture-footnote-sheet.tsx`                                                       | Fully native analog of the DOM `FootnoteContent` sheet (a `@gorhom/bottom-sheet`, not a WebView): verse reference, verse text with a superscript letter at each note position, then the lettered notes — each rendered richly via `renderFootnoteHtml` (note inner HTML back through the same inline renderer). |
| Hanging indent   | `scripture-paragraph-native.tsx` + bundled Expo module (`packages/ui/{ios,android}`) | True poetry/list hanging indent via `NSParagraphStyle` (iOS) / `LeadingMarginSpan` (Android) — the one thing RN `<Text>` can't express. **Now bundled in the SDK and autolinked** (this PR; see below).                                                                                                         |
| Public component | `scripture-text-view.tsx`                                                            | `ScriptureTextView` — fetches the passage via `usePassage`, seeds the SDK installation id (`web-sdk-native-config.ts`), renders, and owns the footnote drawer.                                                                                                                                                  |
| Data seeding     | `lib/web-sdk-native-config.ts`                                                       | Writes the MMKV installation id into the Web SDK global before the hooks provider mounts, so its `localStorage`-backed getter never runs in Hermes.                                                                                                                                                             |

## How the hard parts work

- **Nested `<Text>` flows mixed-style inline runs** — the load-bearing RN fact. A scripture
  paragraph (verse number + body + italics + words-of-Jesus red + footnote markers) is
  exactly that, so the renderer maps the AST to nested `<Text>` and lets RN flow it.
- **Super/subscript & markers** are inline `<View>`s in the text flow (a nested `<Text>`
  can't be raised). Because a `<View>` breaks RN's text-style inheritance, the renderer
  threads font + color into those inner `<Text>`s explicitly — otherwise the glyph drops to
  the system font (wrong baseline) and black (invisible in dark mode).
- **Cross-block verse context** — verses run past their starting block (poetry lines,
  continuation paragraphs). The renderer walks the whole tree once, threading the carried
  verse across blocks, so a footnote tapped in a continuation block still surfaces the whole
  verse and its reference, not just that block's slice.
- **Hanging indent** is the only gap RN genuinely can't close (four pure-RN approaches were
  device-tested and rejected — see ADR 0010). The platforms expose it natively, so it's a
  small native module; **this PR moves that module from the example app into the SDK** so it
  autolinks and is the default (details below).

## This PR specifically: bundling the hanging-indent module in the SDK

The native hanging-indent view used to live in the **example app**
(`apps/example/modules/scripture-paragraph/`) and had to be wired by hand via
`renderHangingParagraph`. This PR moves it **into `@youversion/platform-react-native-expo-ui`**:

- **Autolinks on install** — `expo-module.config.json` at the package root + `ios/` +
  `android/` (the layout installed Expo modules use). No consumer-side native module.
- **Default, not opt-in** — `ScriptureTextView` uses it automatically on native; web falls
  back to the renderer's RN approximation; the `renderHangingParagraph` prop stays as an
  override.
- **Namespaced** `YouVersionScriptureParagraph` (registered name, `requireNativeView`
  string, iOS pod, Android namespace/classes) to avoid collisions in a published SDK.
- **Ships source** (podspec `source_files` + Gradle build-from-source) → codegen always
  matches the app; no `buildFromSource` entry needed (unlike `@expo/dom-webview`).
- **Publish surface** — `package.json` `files` ships `ios`/`android`/`expo-module.config.json`;
  `.npmignore` keeps `android/build` out.
- **Type unification** — the wrapper now shares `ScriptureRun`/`HangingParagraphProps` with
  the renderer, which also cleared 2 pre-existing typecheck errors.

## What we tested — and what worked

All JS-layer checks pass. Run from the repo root.

| Check                 | Command                                                             | Result                                                     |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| UI typecheck          | `pnpm --filter @youversion/platform-react-native-expo-ui typecheck` | ✅ Pass (also cleared 2 pre-existing renderer type errors) |
| Example typecheck     | `pnpm --filter example typecheck`                                   | ✅ Pass                                                    |
| Lint                  | `pnpm lint`                                                         | ✅ Pass                                                    |
| UI test suite         | `pnpm --filter @youversion/platform-react-native-expo-ui test`      | ✅ **191 passed**, 1 skipped, 25 suites                    |
| Stale-reference sweep | `grep` old paths/names across `*.ts/tsx/swift/kt/gradle/json`       | ✅ None                                                    |

### What the tests cover (and confirm works)

The native renderer is tested at the two layers we own (per the project's testing strategy);
the DOM/WebView framework layer is not our responsibility.

- **Layer 1 — pure logic** (no framework):
  - `parse-scripture-html.test.ts` — both HTML shapes parse to the AST: verse markers
    preserved, footnote anchors decoded, whitespace collapsed, hidden classes dropped.
  - `scripture-class-styles.test.ts` — USFM class → style: titles scale + bold, poetry
    staircases by level, list items indent, prose first-line indent, words-of-Jesus red,
    small-caps for divine name, composed character styles, font cascade, light/dark.
- **Layer 3 — native render** (RNTL, DOM/native views mocked as primitives):
  - `scripture-renderer.test.tsx` — renders verse text; verse press → `onVersePress`;
    footnote markers carry full verse context (reference, tokens with lettered note
    positions, all notes); **cross-block verse** surfaces whole verse + reference; `pi3` and
    list-item verses render as one flowing pressable paragraph; super/subscript shrink+raise
    with the body font + themed color threaded in (i18n-safe characters preserved); the
    **native hanging paragraph** receives serialized runs + geometry, including a
    footnote-bearing block (bubble run + tap payload); `renderFootnoteHtml` renders USFM
    footnote character styles (`fr`/`ft`) as inline runs.
  - `scripture-footnote-drawer.test.tsx` — `ScriptureTextView` marker press opens the
    built-in native drawer with reference + verse text + note; closes on `onClose`; not
    wired on web.

Worth calling out for this PR: `scripture-footnote-drawer.test.tsx` renders the real
`ScriptureTextView`, which now imports the bundled native wrapper (triggering the top-level
`requireNativeView`) and uses the **new default** hanging-paragraph path — it passes with the
`jest.setup.js` stub, confirming the default-wiring + test-stub mechanism works end-to-end at
the JS layer. `scripture-renderer.test.tsx` still injects its own mock renderer, confirming
the override path is intact.

- **Bundle** — `apps/example` exports cleanly for iOS via Metro: the hooks package,
  `node-html-parser`, and fonts all resolve under Hermes (no WebView/DOM dependency leaks in).

## Known fidelity gaps (status)

| Gap                                        | Status                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Hanging indent (poetry/list wrapped lines) | **Closed on native** by the bundled module (ADR 0011); web uses the uniform-`paddingLeft` approximation.                      |
| Super/subscript / verse-number raise       | Solved via inline-`<View>` `translateY`; rises are platform-tuned (`SUPERSCRIPT_RISE_EM`, `SCRIPT_SCALE`) — verify on device. |
| Footnote marker placement                  | SVG bubble flows inline; `FOOTNOTE_ICON_EM`/`FOOTNOTE_ICON_DROP_EM` are device-tunable.                                       |
| Small-caps (`nd`/`sc`)                     | `fontVariant: ['small-caps']` is iOS-only / Android-spotty (approximated with uppercase on Android).                          |
| Fonts                                      | Full parity needs Source Serif 4 + Inter registered via `expo-font`; unloaded variants fall back to system font.              |

## What still needs device verification

The JS layer is fully green, but the **real native/DOM bridge — autolinking and the actual
on-device hanging indent, super/subscript, marker placement, and small-caps — can only be
confirmed by a clean native rebuild**, which was out of scope for this environment:

```bash
cd apps/example
pnpm exec expo prebuild --clean
pnpm build:ios        # and/or: pnpm build:android  (Android is the priority surface)
```

Then open the **Native** reader tab and check the proof passages:

- **Psalm 23** (`.q1`/`.q2` poetry) & **Exodus 20** (`.li*` lists) — wrapped lines should hang.
- **Acts 15** — tap a footnote marker (incl. a cross-block verse); the drawer shows the whole verse + reference.
- **Exodus 20** — divine name small-caps (expected iOS-only).
- Compare against the WebView `BibleReader` on the "Bible" tab.

The main risk for this PR is autolinking resolving the bundled module through the pnpm
`workspace:*` symlink; `node-linker=hoisted` (already set in `.npmrc`) is what makes that
work, so it's expected to link, but the clean prebuild is the real proof.

# 17. Verse actions are a native bottom sheet

Date: 2026-08-05

## Status

Accepted

## Context

Verse actions — the reference label, the highlight swatches, Copy, and Share — were drawn inside the DOM WebView by the Web SDK's `VerseActionPopover`. Swift and Kotlin have always presented the same actions as a native bottom sheet. Bringing React Native in line means the popover goes away on native, and three facts made that more than a styling change.

1. **There was no off switch.** `VerseActionPopover` was instantiated unconditionally in the Web SDK's `BibleReader.Root`. The one visibility knob, `highlightsEnabled`, only toggles the swatch row _inside_ the popover, so Copy and Share always rendered. Shipping the native sheet alone would have stacked two action surfaces.
2. **Native could not see the reference, and could not build it.** `onVerseSelect` emitted `book` as a USFM code (`HEB`), not "Hebrews". The human name comes from `useBooks(versionId)` inside the reader. Re-deriving it natively would mean a direct `@youversion/platform-react-hooks` dependency and a duplicate fetch for data the WebView already has.
3. **Native could not clear the selection.** Once the swatch press is native, nothing inside the WebView clears — so a sheet dismiss and a successful write would both leave verses stuck selected.

All three were fixed upstream in `@youversion/platform-react-ui@2.5.0` (`verseActions`, `clearSelectionSignal`, and `reference` / `shareData` on the selection payload), which this ADR consumes.

This decision was implemented once before, on the unmerged reference branch PR #104 (`a23a77ad`), and device-verified there. The presentational files here are ports of that branch. Only the reader's wiring was rewritten, against the core highlights and **Permission Flow** work that landed under YPE-3709 and YPE-3710.

## Decision

### The popover is suppressed, not styled

`verseActions="none"` keeps everything the Web SDK reader is good at — selection, painting, intent emission, payload construction — and removes only the UI. Restyling the popover to look native would have meant reproducing sheet behaviour (pan-to-dismiss, backdrop, safe area, displacement against the reader's other sheets) inside a WebView, in CSS, on two platforms.

### Web keeps the popover, and that fork is deliberate

On web the reader passes `verseActions="popover"`. `NativeSheet` returns `null` on web, so suppressing the popover there would leave the reader with no verse action UI at all — not a degraded one, none.

The branch is a pure function, `lib/resolve-verse-actions.ts`, and the value crosses the bridge as a required prop. The `'use dom'` file cannot read it from `Platform.OS` itself: that file executes inside the WebView, where `react-native`'s `Platform` is not the host's.

**This reverses decision 5 of PR #118 (YPE-3710, U1)**, which removed the same fork on the grounds that web is not a supported target — no web job in CI, no ADR, no README mention — and added a source-text guard pinning `verseActions="none"`. The ticket and the design discussion both require the fork, and Cam settled it on 2026-08-05: the fork ships and the guard is retargeted at the resolver call.

Be honest about what that buys. **The web branch has no runtime coverage in this repo.** There is no web CI job, no web build script, and no device or browser pass. Its only coverage is four layer-1 cases in `lib/__tests__/resolve-verse-actions.test.ts` plus two layer-3 cases — the reader mounts no sheet on web, and it still forwards the selection there, so the first cannot pass on a selection that never fired. Nobody here has watched the web popover render from this branch. Reading the code, the popover's color swatches should be inert — the reader is in controlled mode with no `onHighlightApply` wired — while Copy and Share should still work. That is an inference from the source, not an observation, and it is why the changelog describes web as "the popover, until native verse actions reach it" rather than describing what the popover does.

### Selection is native-owned; clearing it is a counter, not a ref

`native/bible-reader.tsx` holds the committed **Verse Selection** in state, fed by `onVerseSelect` and dropped on a `verses: []` payload. This extends the narrow exception CONTEXT.md already records: we **observe** a committed selection so native chrome can be presented over it. The Web SDK still owns selection state; the only thing travelling back is a clear.

That clear is the **Selection Clear Signal**, a monotonically incremented number. It cannot be a `ref` handle — this is an Expo DOM component, and only serializable props and async **Native Actions** cross that bridge. Same mechanic as `resetKey`, `openKey`, and `dismissKeyboardNonce`: mount value is the baseline, so mounting never clears.

The reader **adds** its own counter to the consumer's `clearSelectionSignal` rather than replacing it. The Web SDK reacts only to changes in the number it receives, so a sum lets the public prop and the reader's own exits both clear. Both start at `0`, so mounting still forwards `0`.

### The sheet is non-modal, and that is load-bearing

`BibleVerseActionSheet` passes `modal={false}` to `NativeSheet`, which drops the backdrop entirely.

This is not styling. A verse selection is **built incrementally**: the user taps a verse, the sheet rises, and they keep tapping to add more. Gorhom's backdrop covers the whole screen with `pointerEvents: 'auto'` while open, so it intercepted the second tap and closed the sheet instead of passing it to the WebView. The reference branch confirmed that on device; the fix was confirmed here on the iOS simulator, where a second verse tap with the sheet open extends the selection and collapses the label to a range.

Setting `opacity: 0` on the backdrop does **not** fix it. Gorhom reads `enableTouchThrough` only for the backdrop's _initial_ `pointerEvents`, then an animated reaction on `animatedIndex` overwrites it to `'auto'` the moment the sheet opens. An invisible backdrop still swallows every tap. The fix has to be dropping the backdrop component. On Android the sheet's outer wrapper also relaxes from `'auto'` to `'box-none'`, or it eats the taps in the backdrop's place.

The cost is that **backdrop-tap-to-dismiss no longer exists**, because there is no backdrop. Remaining exits: swipe-down, deselecting every verse (which emits `verses: []`), or acting on the sheet. Worth knowing: a tap on blank space in the reader does **not** clear the selection — the Web SDK only toggles selection on verse spans — so "tap anywhere else to dismiss" is not one of the exits, and any test or doc that assumes it is wrong.

### Dropping the backdrop is what forced a sheet shadow

Removing the backdrop removed the only thing separating the sheet from the passage behind it. `NativeSheet` now draws an upward drop shadow (`SHEET_TOP_SHADOW` in `lib/native-sheet-theme.ts`).

It uses **`boxShadow`**, not `shadowColor` / `shadowOffset` or `elevation`. RN's `shadow*` family is iOS-only and Android's `elevation` casts a shadow that cannot be aimed, so neither can put a shadow _above_ an edge on both platforms. `boxShadow` is the CSS-spec prop RN added in 0.76, takes a negative `offsetY`, and is cross-platform. It requires the New Architecture, which Expo SDK 55+ makes mandatory, so every consumer of this SDK has it. The typed array form is used over the string form. One gap: outset `boxShadow` needs Android API 28+, below which the sheet renders unshadowed rather than broken.

It goes on Gorhom's `backgroundStyle`, whose default background component is a bare `View` that spreads the style. Nothing between that view and the window clips it: `BottomSheetBody` has no `overflow`, and `BottomSheetContent`'s `overflow: hidden` wraps only the sheet's children as a _sibling_ of the background. The one real clip boundary, `BottomSheetHostingContainer`, spans `topInset` to `bottomInset`. A sheet snapped near the top of the screen would be a different story.

The shadow applies to **every** themed sheet, not just this one, and is keyed off `theme` rather than the resolved surface color — an explicit `backgroundColor` on an unthemed sheet gets no shadow rather than a guessed one. Behind a modal sheet's dimmed backdrop the shadow is simply invisible, which is cheaper than branching on `modal`.

**Dark mode carries much higher alpha** (0.5 / 0.7 against light's 0.06 / 0.14) because a black shadow has little luminance to spend against a near-black surface. The reference branch's device pass measured the reader background at `#0f0f0f` and the sheet surface at `#121212` — a 3-level step, effectively invisible — with the shadow driving the pixels immediately above the edge to `#050505`, a 13-level step, against 36 levels in light mode. Those numbers come from that pass, not from a measurement taken on this branch. If dark mode ever needs to be unambiguous rather than merely better, the next lever is a lightened hairline along the top edge, which is a design decision.

### The tray scrolls; it does not grow

The ANY rule makes overflow routine, not exceptional: two verses of different colors already produce 7 swatches (2 remove + 5 apply), and the palette's worst case is 5 + 5 = 10. The tray keeps a fixed `flex: 1` width and scrolls horizontally under **a gradient fade at each end**, so clipped swatches fade rather than being hard-cut. Copy and Share sit outside the scroll area and never move.

The two fades are one component mirrored: same `x1 → x2` direction, only the stop opacities swap, so the leading edge cannot drift out of sync with the trailing one. The leading fade is the only cue that swatches exist back the way you came.

The fade is drawn with `react-native-svg`, already a peer dependency and already used by this sheet's icons — deliberately **not** `expo-linear-gradient`, which would be a new native module forcing a dev-client rebuild on every consumer for a visual nicety.

It gates on _remaining scroll distance_, not raw overflow, so it retires at the end of the strip. Gating on overflow alone leaves the final swatch permanently dimmed once scrolled to, which reads as disabled.

The shipped YouVersion Bible app does more here: a collapsed tray with a fanned stack that expands, widens, and pushes its action tiles off-screen, plus a pinned "clear all". That was evaluated and deliberately not ported. It exists to manage a seven-color palette and a six-tile action row; we have five colors and two tiles. The app's _growing_ tray is a consequence of that expand interaction, so porting the growth without the gesture would be half of each design.

### The swatch rule is ported from the Web SDK, not re-derived

`lib/verse-action-swatches.ts` ports `activeHighlights` plus the popover's ordering logic. It is an **ANY** rule: every distinct color present _anywhere_ in the selection earns a remove circle, not only colors on _all_ the selected verses.

The research settled the question ADR 0015 left open on the reference branch. That ADR said iOS was "believed" to use an ALL rule. It does not. Both public native SDKs filter their remove list with an "is this color on **any** selected verse" predicate — Kotlin at `BibleReaderViewModel.kt:504-520`, Swift at `BibleReaderViewModel+Navigation.swift:147-160`. Web, Swift, and Kotlin all agree on the remove list, so this port preserves parity rather than creating a divergence.

One difference survives, in the _add_ list. Swift and Kotlin gate it on NOT-ALL; web (and this port) uses `!allColorsActive && (unHighlightedCount > 0 || activeColors.size > 1)`. The two disagree only when all five palette colors are active in one selection: web shows five remove circles and an empty apply row, the native SDKs would also show five apply circles. Cam decided on 2026-08-05 to ship the web rule; that edge stays with the separately tracked ANY-vs-ALL semantics question.

A color covering some but not all of the selected verses therefore appears **twice** — a checkmarked remove circle and a plain apply circle that paints the whole selection in one tap. That is web's shipped behaviour, verified against `verse-action-popover.tsx:270-284` at `ui-2.5.0`, not an accident of the port.

Colors outside the five swatches are ignored, matching the projection the WebView paints from (`deriveHighlightedVerses` drops them). Counting them would size the tray against paint the user cannot see.

### Copy and Share stop crossing the bridge

`onCopy` / `onShare` are native-only props on `BibleReaderProps`. With no popover there is no in-WebView button left to fire them, and `shareData` rides in on `onVerseSelect` — so the native buttons build nothing and cost no round-trip. Consumer override wins; otherwise the SDK falls back to `expo-clipboard` and RN's `Share`, the same shape `VerseOfTheDay` already ships.

One correction to the ticket text, which said removing them from the DOM props would "silently delete two shipped public props". They were never on the reader at all — only on `VerseOfTheDay` — and a test in `bible-reader-highlights-bridge.test.tsx` still pins their absence from the reader's _DOM_ file, which is the point: they are native props now, and nothing about Copy or Share crosses into the WebView. This work **adds** them.

### The write goes through core's Permission Flow, and the reader adds only a sign-in pre-step

The reference branch carried its own gate: `lib/highlight-tap-gate.ts`, a pure predicate, plus hold-and-replay wiring in `native/use-reader-highlights.ts`. None of that is ported. [ADR 0016](0016-highlight-permission-flow.md) makes `useHighlightPermissionFlow` the canonical guard, and core's reducer already owns the **Pending Highlight** and its replay. Duplicating the gate in the UI layer would give a highlight write two places to disagree about whether it is allowed.

So the reader calls `flow.apply(color, verses)` for an apply and `flow.highlights.remove(color, verses)` for a remove. `remove` is deliberately ungated: a user looking at a highlight already has whatever the write needs.

The reader keeps exactly one thing the flow does not have: **a sign-in prompt**. `useHighlightPermissionFlow` calls `auth.signIn()` directly inside its sign-in branch, and its only prompt state, `isConfirming`, is the **Data Exchange** consent. Handing a signed-out tap straight to `flow.apply` would launch OAuth with no explanation of why. The reader therefore holds the intent in a ref, shows `SignInWithYouVersionSheet`, and hands the intent to `flow.apply` on confirm — after which the flow runs sign-in, falls through to consent if the grant is still missing, and writes, all without the user reselecting the verse. Every dismissal path discards the intent.

The signed-out read is `auth !== null && !auth.isAuthenticated`, not `!auth?.isAuthenticated`. `useYVAuthOptional()` returns `null` when the consumer configured no `auth` at all, and that is not the same as signed out: there is nothing to sign in to. For a null auth, `flow.apply` warns once and falls through to the unguarded write, which reports `not-signed-in` — so prompting would open a sheet whose only outcome is the outcome the user already had.

### One sheet at a time, by construction

The action sheet's `isOpen` is `selection !== null && prompt === 'none' && !flow.isConfirming`. `NativeSheet`'s store allows one active sheet and calls `onClose` on whichever it displaces — and this sheet's `onClose` is `closeVerseActions`, which bumps the clear signal. Leaving both "open" would therefore clear the selection as a side effect of losing, and a **Pending Highlight** would replay with nothing selected. A swatch press also closes the sheet immediately, so in practice the sheet is already gone by the time a prompt appears; the gate is what makes that true by construction rather than by ordering.

## Considered alternatives

- **Styling the WebView popover to look native.** Reproduces sheet behaviour in CSS, in a WebView, twice.
- **Keeping the popover and adding the sheet.** Two stacked action surfaces.
- **Deriving the display reference natively.** A direct hooks dependency and a duplicate network fetch for data the WebView already resolved.
- **A `ref` handle to clear the selection.** Impossible across the Expo DOM bridge.
- **Porting `highlight-tap-gate.ts` and its hold-and-replay wiring.** It predates the **Permission Flow**; ADR 0016 makes the flow canonical, and the reducer already owns replay.
- **Dropping the web fork, as PR #118 decided.** Reversed by Cam on 2026-08-05; the ticket requires it.
- **Exporting `BibleVerseActionSheet`.** Kept internal, like `NativeSheetProvider`. The reader owns it; a host wanting its own UI uses `onVerseSelect` plus core's `useHighlights`. `BibleTextView` / `BibleCard` / `VerseOfTheDay` have no verse-tap interaction, so there is no second consumer to design for.

## Consequences

- **Swatch labels do not name their color.** Web's two labels (`applyHighlightAriaLabel` / `clearHighlightAriaLabel`) do not either, and carrying the color would mean coining five color-name keys with no upstream source, which the localization rules forbid from this repo. A screen-reader user hears "Apply highlight" five times. The testIDs already carry the color. Fix it once the copy table has color names; the ticket already records accessibility criteria as blocked on the swatch aria-label i18n ticket.
- `reference` falls back to the USFM book code until `useBooks` resolves inside the WebView. Selecting immediately after a chapter load is how that shows up. Fixing it means holding the payload until books load, which is upstream work.
- `clearSelectionSignal` adds a DOM prop update on every sheet exit. Android has a standing `DomWebView.injectJavaScript` rejection when a prop update is dispatched to an unmounted WebView; this work does not cause it but does make it easier to hit.
- `expo-clipboard` is a new **peer dependency**, so consumers adding this version must install it and rebuild their dev client. `expo-application` is also now a UI peer (the sign-in sheet reads the app's display name), but core already depended on it, so no new autolinked module reaches an app that already had core.
- The sheet is not exported, so its layout is not a public API and can change without a breaking release.

## Verification status

Written down because the manual passes and the automated ones cover different things, and the gap matters when this area is next touched.

| Path                                                                                      | State                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS: selection, sheet, second-verse tap, swipe-down, Copy, Share, top edge in both themes | Verified by Cam on the iPhone 17 simulator, 2026-08-05 (commit `f388555`)                                                                                                                |
| iOS: swatch apply / remove, sign-in prompt, consent prompt                                | Automated only. No manual pass run.                                                                                                                                                      |
| Android: selection, sheet, second-verse tap, swipe-down, Copy, Share, top edge            | Verified by Cam on Android, 2026-08-06. This closes the ticket's "Verified on Android" criterion.                                                                                        |
| Web: the `'popover'` branch                                                               | Never run. Layer-1 and layer-3 tests only; no web CI job, build script, or browser pass.                                                                                                 |
| Swipe-down by hand                                                                        | Done on both platforms — iOS in the simulator, Android in the 2026-08-06 pass. Synthetic pan gestures against Gorhom plus Reanimated prove nothing, so there is no automated equivalent. |
| Shadow contrast numbers in this ADR                                                       | Measured on the reference branch (PR #104), not re-measured here.                                                                                                                        |

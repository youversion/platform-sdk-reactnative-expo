# 17. Verse actions are a native bottom sheet

Date: 2026-08-05

## Status

Accepted

## Context

Verse actions are the reference label, the highlight swatches, Copy, and Share. The Web SDK drew them inside the DOM WebView, with `VerseActionPopover`. Swift and Kotlin have always drawn the same actions as a native bottom sheet.

React Native now matches Swift and Kotlin. The popover goes away on native. Three facts made that more than a styling change.

1. **There was no off switch.** The Web SDK's `BibleReader.Root` always created `VerseActionPopover`. The one visibility prop, `highlightsEnabled`, toggles only the swatch row inside the popover. Copy and Share always rendered. A native sheet alone would have stacked two action surfaces.
2. **Native could not build the reference.** `onVerseSelect` emitted `book` as a USFM code (`HEB`), not "Hebrews". The human name comes from `useBooks(versionId)` inside the reader. To re-derive it natively, this package needs a direct `@youversion/platform-react-hooks` dependency and a second fetch for data the WebView already holds.
3. **Native could not clear the selection.** Once the swatch press is native, nothing inside the WebView clears the selection. A sheet dismiss and a successful write would both leave verses selected.

`@youversion/platform-react-ui@2.5.0` fixed all three. It added `verseActions`, `clearSelectionSignal`, and `reference` / `shareData` on the selection payload. This ADR consumes that release.

PR #104 implemented this decision once before, on an unmerged reference branch (`a23a77ad`), and verified it on device. The presentational files here are ports of that branch. Only the reader's wiring is new, written against the core highlights and **Permission Flow** work from YPE-3709 and YPE-3710.

## Decision

### The popover is suppressed, not styled

`verseActions="none"` removes the popover UI only. The Web SDK reader keeps selection, painting, intent emission, and payload construction.

Restyling the popover to look native means reproducing sheet behavior in CSS, inside a WebView, on two platforms. Sheet behavior here means pan-to-dismiss, backdrop, safe area, and displacement against the reader's other sheets.

### Web keeps the popover, and that fork is deliberate

On web the reader passes `verseActions="popover"`. `NativeSheet` returns `null` on web. Suppressing the popover there leaves the reader with no verse action UI at all.

The branch is a pure function, `lib/resolve-verse-actions.ts`. Its value crosses the bridge as a required prop. The `'use dom'` file cannot read `Platform.OS` itself. That file runs inside the WebView, where `react-native`'s `Platform` is not the host's.

**This reverses decision 5 of PR #118 (YPE-3710, U1).** PR #118 removed the same fork, on the grounds that web is not a supported target: no web job in CI, no ADR, no README mention. It also added a source-text guard pinning `verseActions="none"`. The ticket and the design discussion both require the fork. Cam settled it on 2026-08-05. The fork ships, and the guard now targets the resolver call.

**The web branch has no runtime coverage in this repo.** There is no web CI job, no web build script, and no browser pass. Its coverage is four layer-1 cases in `lib/__tests__/resolve-verse-actions.test.ts` plus two layer-3 cases. The reader mounts no sheet on web, and it still forwards the selection there. Nobody here has watched the web popover render from this branch. Reading the source says the popover's color swatches are inert, because the reader is in controlled mode with no `onHighlightApply` wired, and that Copy and Share still work. That is an inference from source, not an observation. For that reason the changelog says web gets "the popover, until native verse actions reach it" instead of describing what the popover does.

### Selection is native-owned. Clearing it is a counter, not a ref

`native/bible-reader.tsx` holds the committed **Verse Selection** in state. `onVerseSelect` feeds it. A `verses: []` payload drops it.

This extends the narrow exception CONTEXT.md already records. Native **observes** a committed selection so it can present native chrome over it. The Web SDK still owns selection state. Only a clear travels back.

That clear is the **Selection Clear Signal**, a number that only increases. It cannot be a `ref` handle. This is an Expo DOM component, so only serializable props and async **Native Actions** cross the bridge. The mechanic matches `resetKey`, `openKey`, and `dismissKeyboardNonce`. The mount value is the baseline, so mounting never clears.

The reader **adds** its own counter to the consumer's `clearSelectionSignal` instead of replacing it. The Web SDK reacts only to a change in the number it receives. A sum lets both the public prop and the reader's own exits clear. Both start at `0`, so mounting still forwards `0`.

### The sheet is non-modal, and that is load-bearing

`BibleVerseActionSheet` passes `modal={false}` to `NativeSheet`, which drops the backdrop.

A verse selection is **built one verse at a time**. The user taps a verse, the sheet rises, and they keep tapping to add more. Gorhom's backdrop covers the screen with `pointerEvents: 'auto'` while open. It intercepted the second tap and closed the sheet instead of passing the tap to the WebView. PR #104 confirmed that on device. The fix is confirmed here on the iOS simulator: a second verse tap with the sheet open extends the selection and collapses the label to a range.

`opacity: 0` on the backdrop does **not** fix it. Gorhom reads `enableTouchThrough` only for the backdrop's initial `pointerEvents`. An animated reaction on `animatedIndex` then overwrites it to `'auto'` as soon as the sheet opens. An invisible backdrop still takes every tap. The fix has to drop the backdrop component. On Android the sheet's outer wrapper also relaxes from `'auto'` to `'box-none'`, or it takes the taps in the backdrop's place.

The cost is that **backdrop-tap-to-dismiss no longer exists**. The remaining exits are swipe-down, deselecting every verse (which emits `verses: []`), and acting on the sheet. A tap on blank space in the reader does not clear the selection, because the Web SDK toggles selection only on verse spans. "Tap anywhere else to dismiss" is not an exit, and any test or doc that assumes it is wrong.

### Dropping the backdrop forced a sheet shadow

The backdrop was the only thing separating the sheet from the passage behind it. `NativeSheet` now draws an upward drop shadow, `SHEET_TOP_SHADOW` in `lib/native-sheet-theme.ts`.

The shadow uses **`boxShadow`**, not `shadowColor` / `shadowOffset` and not `elevation`. RN's `shadow*` family is iOS-only. Android's `elevation` casts a shadow that cannot be aimed. Neither one can put a shadow above an edge on both platforms. `boxShadow` is the CSS-spec prop RN added in 0.76. It takes a negative `offsetY`, and it works on both platforms. It requires the New Architecture, which Expo SDK 55+ makes mandatory, so every consumer of this SDK has it. This code uses the typed array form, not the string form. One gap: outset `boxShadow` needs Android API 28+. Below API 28 the sheet renders without a shadow rather than broken.

The shadow goes on Gorhom's `backgroundStyle`. The default background component is a bare `View` that spreads that style. Nothing between that view and the window clips it. `BottomSheetBody` has no `overflow`. `BottomSheetContent`'s `overflow: hidden` wraps only the sheet's children, as a sibling of the background. The one real clip boundary, `BottomSheetHostingContainer`, spans `topInset` to `bottomInset`. A sheet snapped near the top of the screen is a different case.

The shadow applies to **every** themed sheet, not only this one. It keys off `theme`, not the resolved surface color, so an unthemed sheet with an explicit `backgroundColor` gets no shadow instead of a guessed one. Behind a modal sheet's dimmed backdrop the shadow is invisible, which is cheaper than branching on `modal`.

**Dark mode carries much higher alpha**: 0.5 and 0.7, against light mode's 0.06 and 0.14. A black shadow has little luminance to spend against a near-black surface. PR #104's device pass measured the reader background at `#0f0f0f` and the sheet surface at `#121212`, a 3-level step that is effectively invisible. With the shadow, the pixels immediately above the edge read `#050505`, a 13-level step. Light mode gets 36 levels. Those numbers come from that pass, not from a measurement on this branch. If dark mode ever needs to be unambiguous rather than better, the next lever is a lightened hairline along the top edge. That is a design decision.

### The tray scrolls. It does not grow

Overflow is routine under the ANY rule. Two verses of different colors already produce 7 swatches: 2 remove plus 5 apply. The palette's worst case is 5 plus 5, or 10.

The tray keeps a fixed `flex: 1` width and scrolls horizontally under **a gradient fade at each end**, so clipped swatches fade instead of hard-cutting. Copy and Share sit outside the scroll area and never move.

One component draws both fades, mirrored. They share the `x1 → x2` direction and swap only the stop opacities, so the two edges cannot drift apart. The leading fade is the only cue that swatches exist behind the scroll position.

The fade uses `react-native-svg`. That package is already a peer dependency, and it already draws this sheet's icons. `expo-linear-gradient` is deliberately not used. It is a new native module, and it would force a dev-client rebuild on every consumer for a visual detail.

Each fade gates on **remaining scroll distance**, not raw overflow, so it retires at the end of the strip. Gating on overflow alone leaves the final swatch permanently dimmed once scrolled to, which reads as disabled.

#### Scrolling the tray on Android needed the sheet's pan constrained to vertical intent

The tray did not scroll on Android at all. Every hidden swatch was unreachable by touch. That was verified on a Pixel 6 Pro API 34 emulator with `John 2:1-3,5` spanning four colors (9 swatches, 6 visible), against five different gesture drivers. The trailing fade rendered throughout, so the tray knew the swatches were there.

`BibleVerseActionSheet` therefore passes `panActiveOffsetY={[-10, 10]}`, which `NativeSheet` forwards to Gorhom's `activeOffsetY`.

The cause is gesture arbitration. Gorhom builds its content pan as a bare `Gesture.Pan()` with no activation criteria (`BottomSheetDraggableView.tsx`). RNGH therefore falls back to `minDist`, which starts at the platform touch slop and is **direction-agnostic** (`PanGestureHandler.kt`). A sideways drag over the tray activates the _sheet's_ pan, and activation cancels the touch stream in every native view underneath it. `RNGestureHandlerRootHelper`'s `RootViewGestureHandler.onCancel` sets `shouldIntercept` and calls `onChildStartedNativeGesture`. The `ScrollView` never sees a move event.

Supplying **any** custom activation criterion makes RNGH drop `minDist` outright. A vertical-only threshold therefore keeps a horizontal drag away from the sheet. The handoff back is symmetric and already wired: once Android's `ScrollView` starts scrolling it calls `requestDisallowInterceptTouchEvent`, which `RNGestureHandlerRootHelper` turns into a cancel of the sheet's pan. 10 sits just above Android's ~8dp slop, so the tray claims a sideways drag first. A swipe-down clears the threshold in its opening points, so dismissal is untouched. iOS never had the bug, because its pan carries no default `minDistSq` (`RNPanHandler.m`), and the threshold is imperceptible there.

**`enableContentPanningGesture={false}` is not an acceptable fix**, though it cures the same symptom. Device-tested: with content panning off the tray scrolls and both fades behave, but swipe-down stops working. Neither a pan nor a fling on the grabber closes the sheet. This is the one sheet with no backdrop, so swipe-down is its only exit that does not require acting on the sheet. That trade buys a reachable swatch and a sheet you cannot close.

Two alternatives were rejected against the installed `@gorhom/bottom-sheet@5.2.14`. **`BottomSheetScrollView`** is Gorhom's own scrollable. It writes its content _height_ into the sheet's `animatedLayoutState.contentHeight` whenever `enableDynamicSizing` is on, which every `NativeSheet` sets, so a short horizontal strip would drive the whole sheet's height. It also registers itself as the sheet's scrollable and drives the pan-down lock off `contentOffset.y`, which a horizontal scroller never moves. **A `Gesture.Native()` wrapper marked simultaneous with the sheet's pan** is what Gorhom does internally, but it needs `BottomSheetDraggableContext`, which the package does not export. Reaching for it would mean a deep import of an internal module, and simultaneity would also let a horizontal fling drag the sheet.

The shipped YouVersion Bible app does more. It has a collapsed tray with a fanned stack that expands, widens, and pushes its action tiles off-screen, plus a pinned "clear all". That design was evaluated and not ported. It manages a seven-color palette and a six-tile action row. This SDK has five colors and two tiles. The app's growing tray is a consequence of the expand gesture, so porting the growth without the gesture gives half of each design.

### The swatch rule is ported from the Web SDK, not re-derived

`lib/verse-action-swatches.ts` ports `activeHighlights` plus the popover's ordering logic. It is an **ANY** rule. Every distinct color present anywhere in the selection earns a remove circle, not only the colors on every selected verse.

Research settled the question ADR 0015 left open on the reference branch. That ADR said iOS was "believed" to use an ALL rule. It does not. Both public native SDKs filter their remove list with an "is this color on any selected verse" predicate. Kotlin does it at `BibleReaderViewModel.kt:504-520`, Swift at `BibleReaderViewModel+Navigation.swift:147-160`. Web, Swift, and Kotlin agree on the remove list, so this port preserves parity rather than creating a divergence.

One difference survives, in the **add** list. Swift and Kotlin gate it on NOT-ALL. Web, and this port, use `!allPaletteColorsActive && (unHighlightedCount > 0 || activeHighlights.size > 1)` (see the 2026-08-12 amendment for YPE-4494's palette-only apply row). The two disagree only when all five palette colors are active in one selection. Web then shows five remove circles and an empty apply row. The native SDKs would also show five apply circles. Cam decided on 2026-08-05 to ship the web rule. That edge stays with the separately tracked ANY-vs-ALL question.

A color covering some but not all of the selected verses appears **twice**: a checkmarked remove circle, and a plain apply circle that paints the whole selection in one tap. That is web's shipped behavior, verified against `verse-action-popover.tsx:270-284` at `ui-2.5.0`.

Apply stays palette-only: the apply row offers only the five `HIGHLIGHT_COLORS` swatches. Remove follows the ANY rule for palette colors and also for valid non-palette hex at its exact value — each earns a checkmarked remove circle. Invalid hex is dropped from paint and from both swatch rows. YPE-4494 locked this seam: partner apps may share a highlights DB with the main Bible app, which can paint valid custom hex from the API; only apply is restricted to the palette.

### Copy and Share stop crossing the bridge

`onCopy` and `onShare` are native-only props on `BibleReaderProps`. With no popover, no in-WebView button fires them. `shareData` rides in on `onVerseSelect`, so the native buttons build nothing and cost no round-trip. A consumer override wins. Otherwise the SDK falls back to `expo-clipboard` and RN's `Share`, the same shape `VerseOfTheDay` already ships.

One correction to the ticket text. It said removing these props from the DOM props would "silently delete two shipped public props". They were never on the reader, only on `VerseOfTheDay`. A test in `bible-reader-highlights-bridge.test.tsx` still pins their absence from the reader's DOM file. That is the point. They are native props now, and nothing about Copy or Share crosses into the WebView. This work **adds** them.

### The write goes through core's Permission Flow, and the reader adds only a sign-in pre-step

The reference branch carried its own gate: `lib/highlight-tap-gate.ts`, a pure predicate, plus hold-and-replay wiring in `native/use-reader-highlights.ts`. None of that is ported. [ADR 0016](0016-highlight-permission-flow.md) makes `useHighlightPermissionFlow` the canonical guard, and core's reducer already owns the **Pending Highlight** and its replay. A second gate in the UI layer gives a highlight write two places to disagree about whether it is allowed.

The reader calls `flow.apply(color, verses)` for an apply and `flow.highlights.remove(color, verses)` for a remove. `remove` is deliberately ungated. A user looking at a highlight already has whatever the write needs.

The reader keeps one thing the flow does not have: **a sign-in prompt**. `useHighlightPermissionFlow` calls `auth.signIn()` directly in its sign-in branch, and its only prompt state, `isConfirming`, is the **Data Exchange** consent. Handing a signed-out tap straight to `flow.apply` launches OAuth with no explanation of why. The reader instead holds the intent in a ref and shows `SignInWithYouVersionSheet`. On confirm it hands the intent to `flow.apply`. The flow then runs sign-in, falls through to consent if the grant is still missing, and writes, without the user reselecting the verse. Every dismissal path discards the intent.

The signed-out read is `auth !== null && !auth.isAuthenticated`, not `!auth?.isAuthenticated`. `useYVAuthOptional()` returns `null` when the consumer configured no `auth` at all. That is not the same as signed out, because there is nothing to sign in to. For a null auth, `flow.apply` warns once and falls through to the unguarded write, which reports `not-signed-in`. Prompting would open a sheet whose only outcome is the outcome the user already had.

### One sheet at a time, by construction

The action sheet's `isOpen` is `selection !== null && prompt === 'none' && !flow.isConfirming`. `NativeSheet`'s store allows one active sheet, and it calls `onClose` on whichever sheet it displaces. This sheet's `onClose` is `closeVerseActions`, which bumps the clear signal. Leaving both sheets open would clear the selection as a side effect of losing, and a **Pending Highlight** would then replay with nothing selected. A swatch press also closes the sheet at once, so in practice the sheet is gone before a prompt appears. The gate makes that true by construction rather than by ordering.

## Considered alternatives

- **Style the WebView popover to look native.** Reproduces sheet behavior in CSS, in a WebView, twice.
- **Keep the popover and add the sheet.** Two stacked action surfaces.
- **Derive the display reference natively.** A direct hooks dependency and a second network fetch for data the WebView already resolved.
- **Use a `ref` handle to clear the selection.** Not possible across the Expo DOM bridge.
- **Port `highlight-tap-gate.ts` and its hold-and-replay wiring.** It predates the **Permission Flow**. ADR 0016 makes the flow canonical, and the reducer already owns replay.
- **Drop the web fork, as PR #118 decided.** Cam reversed that on 2026-08-05. The ticket requires the fork.
- **Export `BibleVerseActionSheet`.** Kept internal, like `NativeSheetProvider`. The reader owns it. A host that wants its own UI uses `onVerseSelect` plus core's `useHighlights`. `BibleTextView`, `BibleCard`, and `VerseOfTheDay` have no verse-tap interaction, so there is no second consumer to design for.

## Consequences

- **Swatch labels do not name their color.** Web's two labels, `applyHighlightAriaLabel` and `clearHighlightAriaLabel`, do not either. Carrying the color means coining five color-name keys with no upstream source, which the localization rules forbid from this repo. A screen-reader user hears "Apply highlight" five times. The testIDs already carry the color. Fix this once the copy table has color names. The ticket already records accessibility criteria as blocked on the swatch aria-label i18n ticket.
- `reference` falls back to the USFM book code until `useBooks` resolves inside the WebView. Selecting immediately after a chapter load is how that shows up. The fix is to hold the payload until books load, which is upstream work.
- `clearSelectionSignal` adds a DOM prop update on every sheet exit. Android has a standing `DomWebView.injectJavaScript` rejection when a prop update reaches an unmounted WebView. This work does not cause that rejection, but it does make the rejection easier to hit.
- `expo-clipboard` is a new **peer dependency**. Consumers who take this version must install it and rebuild their dev client. `expo-application` is also now a UI peer, because the sign-in sheet reads the app's display name. Core already depended on it, so no new autolinked module reaches an app that already had core.
- The sheet is not exported, so its layout is not public API and can change without a breaking release.

## Amendment (2026-08-12): non-palette paint/clear (YPE-4494)

YPE-4494 tightened the swatch seam beyond the original 2026-08-05 port:

- **Remove row:** ANY rule unchanged — every distinct color on any selected verse earns a checkmarked remove circle. Palette colors and valid non-palette hex at their exact value qualify; invalid hex is dropped from paint and from both rows.
- **Apply row:** palette-only. The five `HIGHLIGHT_COLORS` swatches are the only apply targets; non-palette hex never appears as an apply circle.
- **`showAllApplyColors`:** the apply row shows the full palette when `!allPaletteColorsActive && (unHighlightedCount > 0 || activeHighlights.size > 1)`. The first half (`allPaletteColorsActive`) counts only palette colors; the second half (`activeHighlights.size > 1`) counts all valid colors, palette or non-palette. That dual-half rule matches the web SDK YPE-4494 tray (`buildVerseActionSwatches` in platform-sdk-react PR #330), not the published 2.5.0 popover formula alone.

Core's `apply` rejects non-palette colors as `invalid` before painting or issuing a request. Valid non-palette hex from the API still paints and clears through the remove row. The WebView reader paint path depends on a future `@youversion/platform-react-ui` pin after web #330 publishes; that pin is tracked separately from this native tray work.

## Verification status

The manual passes and the automated ones cover different things. The gap matters when this area is next touched.

| Path                                                                                      | State                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS: selection, sheet, second-verse tap, swipe-down, Copy, Share, top edge in both themes | Verified by Cam on the iPhone 17 simulator, 2026-08-05 (commit `f388555`)                                                                      |
| iOS: swatch apply / remove, sign-in prompt, consent prompt                                | Automated only. No manual pass run.                                                                                                            |
| Android: selection, sheet, second-verse tap, Copy, Share, both themes, top edge           | Run on a Pixel 6 Pro API 34 emulator, 2026-08-06. This closes the ticket's "Verified on Android" criterion.                                    |
| Android: swatch apply / remove, sign-in prompt, consent prompt, data-exchange grant       | Same pass. One green highlight written and removed against a real signed-in account. UI and MMKV cache confirmed, server state not read back.  |
| Android: swatch tray scroll                                                               | Same pass. Found the dead tray fixed above, then re-run against the fix. The tray scrolls, and every hidden swatch is reachable.               |
| Web: the `'popover'` branch                                                               | Never run. Layer-1 and layer-3 tests only. No web CI job, build script, or browser pass.                                                       |
| Swipe-down by hand                                                                        | iOS only, in the simulator. Synthetic pan gestures against Gorhom plus Reanimated prove nothing, so there is no automated equivalent.          |
| Swipe-down on Android, with `panActiveOffsetY` applied                                    | Synthetic `adb input swipe`, from the grabber and from the sheet body. Both dismissed the sheet and cleared the selection. Not a by-hand pass. |
| Shadow contrast numbers in this ADR                                                       | Measured on the reference branch (PR #104), not re-measured here.                                                                              |

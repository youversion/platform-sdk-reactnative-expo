# Native verse action sheet

Verse actions — the reference label, the highlight swatches, Copy and Share — are a native `NativeSheet` raised by `BibleReader`, not the Web SDK's in-WebView popover. The popover is suppressed outright with `verseActions="none"`, and the reader clears the WebView's selection through a counter prop.

## Context

Swift and Kotlin have always presented verse actions as a native bottom sheet. React Native had none: the equivalent UI was `VerseActionPopover`, rendered inside the DOM WebView, which is what every earlier highlights phase drove. Bringing RN in line means the popover has to go, and three facts made that more than a styling change.

1. **There was no off switch.** `VerseActionPopover` was instantiated unconditionally in the Web SDK's `BibleReader.Root`, gated only on `popoverOpen && selectedVerses.length > 0`. The one visibility knob that existed, `highlightsEnabled`, only toggles the swatch row _inside_ the popover and is computed internally — Copy and Share always rendered. Shipping the native sheet alone would stack two action surfaces.
2. **Native could not see the reference, and could not build it.** `onVerseSelect` emitted only `{ versionId, book, chapter, verses, passageIds }`, where `book` is the USFM code (`HEB`), not "Hebrews". The human name comes from `useBooks(versionId)` inside the reader. Re-deriving it natively would mean a direct `@youversion/platform-react-hooks` dependency and a duplicate fetch for data the WebView already has.
3. **Native could not clear the selection.** The reader's own `closeAndClearSelection` had no external trigger. Once the swatch press is native, nothing inside the WebView clears — so both a sheet dismiss _and_ a successful write would leave verses stuck selected.

All three were fixed upstream in `@youversion/platform-react-ui@2.5.0` (`verseActions`, `clearSelectionSignal`, and `reference` / `shareData` on the selection payload), which this ADR consumes.

## Decision

### The popover is suppressed, not styled

`verseActions="none"` keeps everything the reader is good at — selection, painting, intent emission, payload construction — and removes only the UI. Restyling the popover to look like a bottom sheet would have meant reproducing native sheet behaviour (pan-to-dismiss, backdrop, safe-area, displacement against the reader's other three sheets) inside a WebView, in CSS, on two platforms.

On **web** the reader keeps `verseActions="popover"`. `NativeSheet` renders nothing there, so suppressing it would leave no verse-action UI at all, and the Web SDK's `navigator.clipboard` / Web Share defaults are the right behaviour on that platform anyway.

### Selection is native-owned; clearing it is a counter, not a ref

`native/bible-reader.tsx` holds the committed selection in state, fed by `onVerseSelect` and dropped on a `verses: []` payload. This extends the narrow exception CONTEXT.md already records for `onVerseSelect`: we **observe** a committed selection to present native chrome over it. The reader still owns selection state; the only thing travelling back is a clear.

That clear is `clearSelectionSignal`, a monotonically incremented number. It cannot be a `ref` handle — this is an Expo DOM component, and only serializable props and async Native Actions cross that bridge. It is the same mechanic as `resetKey`, `openKey`, and `dismissKeyboardNonce`: a one-way native → DOM command, mount value as baseline so mounting never clears.

### The sheet is non-modal, and that is load-bearing

`BibleVerseActionSheet` passes `modal={false}` to `NativeSheet`, which drops the backdrop entirely.

This is not styling. A verse selection is **built incrementally** — the user taps a verse, the sheet rises, and they keep tapping to add more. Gorhom's backdrop covers the whole screen with `pointerEvents: 'auto'` while the sheet is open, so it intercepted the second tap and closed the sheet instead of passing it to the WebView. Multi-verse selection was impossible; confirmed on device.

Setting `opacity: 0` on the backdrop does **not** fix it. Gorhom reads `enableTouchThrough` only for the backdrop's _initial_ `pointerEvents`, then an animated reaction on `animatedIndex` overwrites it to `'auto'` the moment the sheet opens. An invisible backdrop still swallows every tap. The fix has to be dropping the backdrop component. On Android the sheet's outer wrapper also has to relax from `'auto'` to `'box-none'`, or it eats the taps in the backdrop's place.

The cost is that **backdrop-tap-to-dismiss no longer exists**, because there is no backdrop. Remaining exits: swipe-down, deselecting every verse (which emits `verses: []`), or acting on the sheet. Worth knowing: a tap on blank space in the reader does **not** clear the selection — the Web SDK only toggles selection on verse spans — so "tap anywhere else to dismiss" is not one of the exits, and any test or doc that assumes it is wrong.

### Dropping the backdrop is what forced a sheet shadow

Removing the backdrop removed the only thing separating the sheet from the passage behind it. The
top edge became genuinely hard to find, which is a direct consequence of the decision above, so
`NativeSheet` now draws an upward drop shadow (`SHEET_TOP_SHADOW` in `lib/native-sheet-theme.ts`).

It uses **`boxShadow`**, not `shadowColor`/`shadowOffset` or `elevation`. RN's `shadow*` family is
iOS-only and Android's `elevation` casts a shadow that cannot be aimed, so neither can put a shadow
_above_ an edge on both platforms. `boxShadow` is the CSS-spec prop RN added in 0.76, takes a
negative `offsetY`, and is cross-platform. It requires the New Architecture — which Expo SDK 55+
makes mandatory, having removed the legacy architecture outright — so every consumer of this SDK
has it. The typed array form is used over the string form. The one gap: outset `boxShadow` needs
Android API 28+, below which the sheet renders unshadowed rather than broken.

It goes on Gorhom's `backgroundStyle`, whose default background component is a bare `View` that
spreads the style. Nothing between that view and the window clips it: `BottomSheetBody` has no
`overflow`, and `BottomSheetContent`'s `overflow: hidden` wraps only the sheet's children as a
_sibling_ of the background. The one real clip boundary, `BottomSheetHostingContainer`, spans
`topInset` to `bottomInset` — nearly the whole window — so a 32dp shadow on a sheet near the bottom
is nowhere near it. No custom `backgroundComponent` is needed. A sheet snapped near the top of the
screen would be a different story.

The shadow is applied to **every** sheet, not just this one, and is keyed off `theme` rather than
the resolved surface color — an explicit `backgroundColor` on an unthemed sheet gets no shadow
rather than a guessed one. Behind a modal sheet's dimmed backdrop the shadow is simply invisible,
which is cheaper than branching on `modal`.

**Dark mode carries much higher alpha** (0.5 / 0.7 against light's 0.06 / 0.14) because a black
shadow has little luminance to spend against a near-black surface. Measured on device: the reader
background sits at `#0f0f0f` and the sheet surface at `#121212`, a 3-level step that is effectively
invisible; the shadow drives the pixels immediately above the edge down to `#050505`, making it a
13-level step. That is a real improvement, not a full substitute for the light-mode effect, where
the same shadow buys 36 levels. If dark mode ever needs to be unambiguous rather than merely
better, the next lever is a lightened hairline along the top edge — a design decision, not a
tuning one.

### The tray scrolls; it does not grow

The ANY rule makes overflow routine, not exceptional: two verses of different colours already
produce 7 swatches (2 remove + 5 apply), and the palette's worst case is 5 + 5 = 10. The tray
keeps a fixed `flex: 1` width and scrolls its contents horizontally under **a gradient fade at each
end**, so clipped swatches fade out rather than being hard-cut. Copy and Share sit outside the
scroll area and never move.

The two fades are one component mirrored: same `x1 → x2` direction, only the stop opacities swap,
so the leading edge cannot drift out of sync with the trailing one. The leading fade is the only
cue that swatches exist back the way you came — without it the strip is hard-cut on the left and
scrolled swatches simply vanish.

The fade is drawn with `react-native-svg`, already a peer dependency and already used by this
sheet's icons — deliberately **not** `expo-linear-gradient`, which would be a new native module
and would force a dev-client rebuild on every consumer for a visual nicety.

It is gated on _remaining scroll distance_, not raw overflow, so it retires at the end of the
strip. Gating on overflow alone leaves the final swatch permanently dimmed once scrolled to,
which reads as disabled.

The shipped YouVersion Bible app does more here — a collapsed tray with a fanned stack that
expands, widens, and pushes its action tiles off-screen, plus a pinned black ⊗ "clear all". That
was evaluated and deliberately not ported: it exists to manage a seven-colour palette and a
six-tile action row, and we have five colours and two tiles. Note the app's _growing_ tray is a
consequence of that expand interaction — porting the growth without the gesture would be half of
each design. The ⊗ is a core write path we do not have, and is a separate ticket.

### The swatch rule is ported from the Web SDK, not re-derived

`lib/verse-action-swatches.ts` is a port of `activeHighlights` plus the popover's ordering logic. It is an **ANY** rule: every distinct colour present _anywhere_ in the selection earns a remove circle, not only colours on _all_ the selected verses. iOS is believed to use the ALL rule, but nobody on this side has read that code or seen the two side by side, and the shipped web rule is the only one anyone here can point at. RN diverging from web would be a _new_ divergence rather than a preserved one.

This moves the question from "file a `@youversion/platform-react-ui` ticket" to "flip one predicate in this file" — it is now RN's decision to own. A side-by-side against the iOS app is still wanted.

Colours outside the five swatches are ignored, matching the projection the WebView paints from (`deriveHighlightedVerses` drops them). Counting them would size the tray against paint the user cannot see.

### Copy and Share stop crossing the bridge

`onCopy` / `onShare` are removed from the DOM component's props entirely. With no popover there is no in-WebView button left to fire them, and `shareData` now rides in on `onVerseSelect` — so the native buttons build nothing and cost no round-trip. The consumer-override-then-SDK-fallback contract from Phase 5 is unchanged; only the caller moved, which is why that suite was rewired rather than deleted.

Because those props were previously inherited onto the public `BibleReaderProps` through `Omit<DomBibleReaderProps, …>`, they are now declared explicitly on the native props type. The public surface is identical.

### The action sheet yields to the sign-in sheet

`isOpen` is gated on `selection !== null && prompt === 'none'`. `NativeSheet`'s store allows one active sheet at a time and calls `onClose` on whichever it displaces — so leaving both "open" would clear the selection as a side effect of losing, and the Pending Highlight would replay with nothing selected. A swatch press also clears the selection immediately, so in practice the sheet is already closed by the time a prompt appears; the gate is what makes that true by construction rather than by ordering.

## Considered alternatives

- **Styling the WebView popover to look native.** Reproduces sheet behaviour in CSS, in a WebView, twice.
- **Keeping the popover and adding the sheet.** Two action surfaces stacked; this is exactly what Phase 8 exists to prevent.
- **Deriving the display reference natively.** A direct hooks dependency and a duplicate network fetch for data the WebView already resolved.
- **A `ref` handle to clear the selection.** Impossible across the Expo DOM bridge.
- **Re-deriving the swatch rule from the iOS behaviour we assume.** Would ship a divergence from web based on code nobody here has read.
- **Exporting `BibleVerseActionSheet`.** Kept internal, like `NativeSheetProvider`. The reader owns it; a host wanting its own UI uses core's `useHighlights`. `BibleTextView` / `BibleCard` / `VerseOfTheDay` have no verse-tap interaction at all today, so there is no second consumer to design for.

## Consequences

- The sheet's copy uses the React Web SDK's existing keys for the same buttons — `copy`, `share`, `applyHighlightAriaLabel`, `clearHighlightAriaLabel` — rather than coining new names. As with the consent flow (ADR 0014), those keys are not yet in the generated `packages/ui/src/i18n/locales/en.json`, so i18next renders the key string until the `platform-localization` sync lands. Swift is expected to have canonical keys for Copy and Share; confirming them is a lookup, and a rename here is find-and-replace because tests assert on keys and testIDs, never English.
- **Swatch labels do not name their colour.** Web's two labels don't either, and carrying the colour would mean coining five colour-name keys with no upstream source, which the localization rules forbid from this repo. A screen-reader user currently hears "Apply highlight" five times. Worth fixing once the copy table has colour names; the testIDs already carry the colour.
- `reference` falls back to the USFM book code until `useBooks` resolves inside the WebView. Selecting immediately after a chapter load is how that shows up. Fixing it means holding the payload until books load, which is upstream work.
- `clearSelectionSignal` adds a DOM prop update on every sheet exit. Android has a standing `DomWebView.injectJavaScript` rejection when a prop update is dispatched to an unmounted WebView; this phase does not cause it but does make it easier to hit.
- `packages/ui` now pins `@youversion/platform-react-ui@2.5.0`, and `pnpm-workspace.yaml` exempts `@youversion/*` from the 3-day publish cooldown. That is the documented permanent exemption, and it widens the blast radius of a leaked npm token on our own scope — a deliberate trade, since a compromised first-party publish is a problem the cooldown only delays.

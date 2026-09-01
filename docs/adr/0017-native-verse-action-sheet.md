# 17. Verse actions are a native bottom sheet

Date: 2026-08-05
Amended: 2026-08-12 — apply is palette-only. Remove follows the ANY rule for valid hex.
Amended: 2026-08-24 — unconfigured auth omits the swatch tray. Copy and Share remain.
Amended: 2026-08-25 — apply palette is six hexes (YPE-5059). Native dots mix against SHEET_SURFACE.
Amended: 2026-09-01 — pin `@youversion/platform-react-ui` 2.12.0 so reader fill and WOC match YPE-5058.

## Status

Accepted

Verse actions are the reference, Copy, and Share, and the highlight swatches when `auth` is configured. A missing `auth` omits the tray so a color tap cannot no-op. Swift and Kotlin draw these as a native bottom sheet. React Native matches them. The WebView popover is suppressed on iOS and Android with `verseActions="none"`. The Web SDK still owns selection and the selection payload. It renders controlled highlights. Native owns the paint data ([ADR 0013](0013-native-highlights-optimistic-layer.md)).

**Web keeps the popover.** `NativeSheet` renders nothing on web. Suppressing the popover there leaves no verse-action UI. The fork is `lib/resolve-verse-actions.ts`. The `'use dom'` file cannot read the host `Platform.OS`.

**The sheet is non-modal.** A selection is built one verse at a time. Gorhom's backdrop takes the second tap and closes the sheet. An `opacity: 0` backdrop does not help: Gorhom overwrites `pointerEvents` to `'auto'` on open. The backdrop is dropped. The cost is that tap-outside dismiss does not exist. The exits are swipe-down, deselect, or an action on the sheet. Every themed sheet draws an upward drop shadow so a sheet without a backdrop still separates from the page.

**Clearing the selection is a counter, not a ref.** Only serializable props cross the Expo DOM bridge. `clearSelectionSignal` only increases. The mount value is the baseline, so mounting never clears.

**Do not turn off content panning to make the swatch tray scroll.** On Android, Gorhom's pan has no activation criteria, so a sideways drag claims the sheet and cancels the tray `ScrollView`. `panActiveOffsetY` constrains that pan to vertical intent. `enableContentPanningGesture={false}` scrolls the tray and kills swipe-down. This sheet has no backdrop, so swipe-down is the only exit that does not act on the sheet.

**The tray fades gate on remaining scroll, not overflow.** `swatchTrayFadeGates` answers both ends from one triple (`trayWidth`, `contentWidth`, `scrollX`) with `FADE_GATE_PX` of slack. The three measurements travel together. Gating on overflow alone leaves the last swatch dimmed once scrolled to.

**Copy and Share stay native.** `onCopy` and `onShare` are native-only props. `shareData` rides in on `onVerseSelect`, so neither button crosses the bridge.

**Writes go through `useHighlightPermissionFlow`.** A second gate in the UI layer gives a write two places to disagree. The reader adds only a sign-in prompt in front, because the flow calls `signIn()` with no UI of its own. A `null` auth is unconfigured, not signed out, and must not raise a prompt. The swatch tray is omitted in that case — Copy and Share stay — so a color tap cannot no-op. The action sheet stays closed while a prompt is up, so displacement cannot clear a Pending Highlight.

**The sheet stays internal.** A host that wants its own UI uses `onVerseSelect` plus `useHighlights`.

Apply offers only the six `HIGHLIGHT_COLORS`. Remove follows the ANY rule: every valid hex on any selected verse earns a remove circle, palette or not. Invalid hex is dropped. That matches web YPE-4494, Swift, and Kotlin on the remove list. Native dots mix stored hex against `SHEET_SURFACE` with `mixSrgb` (light identity, dark `p = 0.20`). Reader fill and Words of Christ (`#94000C` / `#e4bfc2`, unmixed) come from the pinned `@youversion/platform-react-ui` 2.12.0.

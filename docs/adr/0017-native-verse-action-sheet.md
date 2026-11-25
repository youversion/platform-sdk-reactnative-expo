# 17. Verse actions are a native bottom sheet

Date: 2026-08-05
Amended: 2026-08-12 — apply is palette-only. Remove follows the ANY rule for valid hex.
Amended: 2026-08-24 — unconfigured auth omits the swatch tray. Copy and Share remain.
Amended: 2026-08-25 — apply palette is six hexes (YPE-5059). Native dots mix against SHEET_SURFACE.
Amended: 2026-09-01 — pin `@youversion/platform-react-ui` 2.12.0 so reader fill and WOC match YPE-5058.
Amended: 2026-10-08. `BibleReader` draws selection and highlights in native text.
Amended: 2026-10-13. The WebView reader is gone.
Amended: 2026-11-24. Hosts order the actions and add their own (YPE-6787). The sheet stays internal.
Amended: 2026-11-25. Save is a built-in, on by default (YPE-6788). It opens the note composer after the sheet closes.

## Status

Accepted

Verse actions are the reference, Copy, and Share, and the highlight swatches when `auth` is configured. A missing `auth` omits the tray so a color tap cannot no-op. Swift and Kotlin draw these as a native bottom sheet. React Native matches them. The native reader owns selection, the selection payload, and highlight paint ([ADR 0013](0013-native-highlights-optimistic-layer.md)).

**Web has no verse-action sheet.** `NativeSheet` renders nothing on web, and the chapter is not a WebView. Expo web is out of scope.

**The sheet is non-modal.** A selection is built one verse at a time. Gorhom's backdrop takes the second tap and closes the sheet. An `opacity: 0` backdrop does not help: Gorhom overwrites `pointerEvents` to `'auto'` on open. The backdrop is dropped. The cost is that tap-outside dismiss does not exist. The exits are swipe-down, deselect, or an action on the sheet. Every themed sheet draws an upward drop shadow so a sheet without a backdrop still separates from the page.

**Clearing the selection is a counter, not a ref.** Only serializable props cross the Expo DOM bridge. `clearSelectionSignal` only increases. The mount value is the baseline, so mounting never clears.

**Do not turn off content panning to make the swatch tray scroll.** On Android, Gorhom's pan has no activation criteria, so a sideways drag claims the sheet and cancels the tray `ScrollView`. `panActiveOffsetY` constrains that pan to vertical intent. `enableContentPanningGesture={false}` scrolls the tray and kills swipe-down. This sheet has no backdrop, so swipe-down is the only exit that does not act on the sheet.

**The tray fades gate on remaining scroll, not overflow.** `swatchTrayFadeGates` answers both ends from one triple (`trayWidth`, `contentWidth`, `scrollX`) with `FADE_GATE_PX` of slack. The three measurements travel together. Gating on overflow alone leaves the last swatch dimmed once scrolled to.

**Copy and Share stay native.** `onCopy` and `onShare` are native-only props. `shareData` rides in on `onVerseSelect`, so neither button crosses the bridge.

**Writes go through `useHighlightPermissionFlow`.** A second gate in the UI layer gives a write two places to disagree. The reader adds only a sign-in prompt in front, because the flow calls `signIn()` with no UI of its own. A `null` auth is unconfigured, not signed out, and must not raise a prompt. The swatch tray is omitted in that case — Copy and Share stay — so a color tap cannot no-op. The action sheet stays closed while a prompt is up, so displacement cannot clear a Pending Highlight.

**The sheet stays internal; its row is the host's.** `verseActions` orders the built-ins and adds custom actions, as in Swift. A host that wants a different sheet uses `onVerseSelect` plus `useHighlights`.

**Save is a built-in.** The default row is highlight, Save, Copy, Share. Save closes this sheet, then opens the note composer for the same passage, gaps included. A missing `auth` config leaves the button in place and does not start sign-in.

**A duplicate action id keeps the first.** Swift traps on it. A typo in a host list should not crash a reader, so React Native warns in development and drops the later entry.

**A custom action runs after the sheet commits closed.** The reader snapshots the merged ranges, clears the selection, and calls `onPress` once the native sheet finishes dismissing (`NativeSheet` `onClosed`), in Swift's order. A rejection is logged, not surfaced. The host owns its own feedback.

**One scrolling row holds every action.** Tiles grow from their content (`flexGrow: 1`, not `flex: 1`), so a long custom label scrolls instead of squeezing its neighbours.

Apply offers only the six `HIGHLIGHT_COLORS`. Remove follows the ANY rule: every valid hex on any selected verse earns a remove circle, palette or not. Invalid hex is dropped. That matches web YPE-4494, Swift, and Kotlin on the remove list. Native dots mix stored hex against `SHEET_SURFACE` with `mixSrgb` (light identity, dark `p = 0.20`). Reader fill and Words of Christ (`#94000C` / `#e4bfc2`, unmixed) come from the pinned `@youversion/platform-react-ui` 2.12.0.

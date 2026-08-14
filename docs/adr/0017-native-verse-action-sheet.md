# 17. Verse actions are a native bottom sheet

Date: 2026-08-05
Amended: 2026-08-12 — apply is palette-only. Remove follows the ANY rule for valid hex.

## Status

Accepted

Verse actions are the reference, the highlight swatches, Copy, and Share. Swift and Kotlin draw these as a native bottom sheet. React Native matches them. The WebView popover is suppressed on iOS and Android with `verseActions="none"`. The Web SDK still owns selection, paint, and the selection payload.

**Web keeps the popover.** `NativeSheet` renders nothing on web. Suppressing the popover there leaves no verse-action UI. The fork is `lib/resolve-verse-actions.ts`. The `'use dom'` file cannot read the host `Platform.OS`.

**The sheet is non-modal.** A selection is built one verse at a time. Gorhom's backdrop takes the second tap and closes the sheet. An `opacity: 0` backdrop does not help: Gorhom overwrites `pointerEvents` to `'auto'` on open. The backdrop is dropped. The cost is that tap-outside dismiss does not exist. The exits are swipe-down, deselect, or an action on the sheet. Every themed sheet draws an upward drop shadow so a sheet without a backdrop still separates from the page.

**Clearing the selection is a counter, not a ref.** Only serializable props cross the Expo DOM bridge. `clearSelectionSignal` only increases. The mount value is the baseline, so mounting never clears.

**Do not turn off content panning to make the swatch tray scroll.** On Android, Gorhom's pan has no activation criteria, so a sideways drag claims the sheet and cancels the tray `ScrollView`. `panActiveOffsetY` constrains that pan to vertical intent. `enableContentPanningGesture={false}` scrolls the tray and kills swipe-down. This sheet has no backdrop, so swipe-down is the only exit that does not act on the sheet.

**Writes go through `useHighlightPermissionFlow`.** A second gate in the UI layer gives a write two places to disagree. The reader adds only a sign-in prompt in front, because the flow calls `signIn()` with no UI of its own. A `null` auth is unconfigured, not signed out, and must not raise a prompt. The action sheet stays closed while a prompt is up, so displacement cannot clear a Pending Highlight.

**The sheet stays internal.** A host that wants its own UI uses `onVerseSelect` plus `useHighlights`.

Apply offers only the five `HIGHLIGHT_COLORS`. Remove follows the ANY rule: every valid hex on any selected verse earns a remove circle, palette or not. Invalid hex is dropped. That matches web YPE-4494, Swift, and Kotlin on the remove list.

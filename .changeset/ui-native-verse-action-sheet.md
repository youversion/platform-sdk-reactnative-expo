---
'@youversion/platform-react-native-expo-ui': minor
---

`BibleReader`'s verse actions are now a **native bottom sheet** instead of the popover the Web SDK drew inside the WebView.

**This is a visible behaviour change for anyone already shipping `BibleReader`.** Selecting verses no longer floats a pill over the passage; it raises a bottom sheet carrying the localized reference (`Hebrews 11:4`, not `HEB 11:4`), the five highlight swatches, Copy, and Share — matching the YouVersion iOS and Android apps. Dismissing the sheet clears the selection, as does applying or removing a highlight, copying, or sharing.

No new peer dependencies, so **no dev-client rebuild** — this is JavaScript only plus a Web SDK version bump.

## What changed under it

- `@youversion/platform-react-ui` moves to `2.5.0` for its new `verseActions` and `clearSelectionSignal` props and the `reference` / `shareData` fields on the verse-selection payload. The SDK passes `verseActions="none"` to suppress the built-in popover on every platform but web, where the popover remains the only verse-action UI there is.
- `onCopy` and `onShare` still work exactly as before — consumer handler wins, otherwise the SDK falls back to `expo-clipboard` and React Native's `Share`. They are now fired by the native sheet's buttons rather than by the WebView, which removes a bridge round-trip per copy.
- `onVerseSelect` still fires on every selection change, including the `verses: []` clear, and its payload gains `reference` and `shareData` from the Web SDK.
- The swatch tray follows the Web SDK's shipped rule: a checkmarked remove circle for every distinct colour present anywhere in the selection, remove circles first, both in canonical palette order. Because that rule makes overflow routine — two verses of different colours already produce seven circles — the tray scrolls horizontally under a gradient fade at each end, with Copy and Share pinned outside it.
- The verse action sheet is **non-modal**: it draws no backdrop, so the passage behind stays bright and tappable and a selection can be built up one verse at a time. The trade-off is that tapping outside the sheet no longer dismisses it; swipe down, deselect every verse, or act on the sheet.
- **All bottom sheets now cast an upward drop shadow**, which is what separates a backdrop-less sheet from the content behind it. This uses RN's `boxShadow`, so it requires the New Architecture — mandatory on Expo SDK 55+ — and Android API 28+, below which sheets simply render unshadowed.

`pnpm-workspace.yaml` also exempts the `@youversion/*` scope from the repo's 3-day dependency cooldown, so first-party releases can be consumed the day they publish.

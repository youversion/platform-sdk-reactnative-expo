---
'@youversion/platform-react-native-expo-core': patch
'@youversion/platform-react-native-expo-ui': patch
---

`BibleReader` now renders natively-owned highlights, and the in-WebView verse action popover is switched off.

The reader subscribes to `useHighlights` for its current version / book / chapter and feeds the result into the Web SDK reader as a controlled prop. Because the MMKV cache read is synchronous, highlights are in the very first props — no blank first frame. Nothing about the highlight path runs inside the WebView any more: no network calls, no local store, no auth surface.

**`verseActions="none"` is now hardcoded.** Until the native verse action sheet lands (YPE-3712), selecting a verse raises **no** action UI inside the reader — the color swatches, Copy, and Share buttons are gone. Verse selection and selection painting are unchanged. Two new props replace what the popover provided:

- `onVerseSelect(selection)` fires on every selection change, including clears (`verses: []`). The payload carries `versionId`, `book`, `chapter`, `verses`, `passageIds`, a localized `reference` (`Hebrews 11:4`, not `HEB 11:4`), and the `shareData` the popover's Copy / Share buttons would have used — all bridge-safe primitives.
- `clearSelectionSignal` dismisses the current selection from native. Increment it; the value at mount is the baseline, so mounting never clears. A counter rather than an imperative ref handle because only serializable props cross the DOM bridge.

`BibleReaderVerseSelection` and `BibleReaderShareData` are re-exported so a handler can be typed without depending on `@youversion/platform-react-ui` directly.

On the core side, `useHighlights` now gates its GET on the app having **requested** the `highlights` permission (`auth.permissions` on `YouVersionProvider`). Without it the SDK issues no highlights request at all — so an app that renders a reader and never asked for highlights pays nothing. The gate reads the requested list, never a grant: a missing grant is indistinguishable from an unknown one, and treating unknown as denied would silently un-paint the highlights of users who signed in before grant reporting existed. `useYVAuth()` gains `requestedPermissions` to carry it, defaulting to `[]`.

Not in this change: applying or removing highlights from native, the native verse action sheet, and copy / share.

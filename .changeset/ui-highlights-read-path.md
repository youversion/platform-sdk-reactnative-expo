---
'@youversion/platform-react-native-expo-ui': minor
---

`BibleReader` now renders the signed-in user's highlights.

The reader reads them from core's `useHighlights` through a new internal orchestrator (`useReaderHighlights`) and hands them to the Web SDK's controlled reader, so highlights created in the YouVersion app or on youversion.com paint in the native reader. They come from the MMKV cache synchronously, so a revisited chapter paints on the first frame with no spinner and no flash of unhighlighted text — and still paints offline.

Read path only for now: the color swatches in the verse drawer stay inert until the write path lands. Highlights require `auth` configured on `YouVersionProvider` with the `highlights` permission requested; with no auth configured, or signed out, the reader behaves exactly as it does today.

Highlights stay SDK-owned — there is no new public prop, and the Web SDK's controlled mode remains an internal mechanism rather than a supported surface. Hosts that want to build their own highlight UI should use `useHighlights` from `@youversion/platform-react-native-expo-core`.

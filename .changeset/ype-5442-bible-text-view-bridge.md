---
'@youversion/platform-react-native-expo-ui': patch
---

fix: resolve BibleTextView light/dark on native and pass that scheme into the in-WebView provider (YPE-5442 / RNV2-4). Font size and family stay consumer props; `fontFamily` still crosses as an ADR 0009 token, not a `getTokens` value.

Standalone `BibleTextView` now uses the same content-sized embed defaults as `BibleCard` / `VerseOfTheDay` (`matchContents`, `flex: 0`, scroll off). Pass `dom={{ matchContents: false }}` to opt out and size with flex styles.

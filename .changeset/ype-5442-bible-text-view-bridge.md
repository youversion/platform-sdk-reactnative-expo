---
'@youversion/platform-react-native-expo-ui': patch
---

fix: drive BibleTextView reader theme from ported tokens across the native↔DOM bridge (YPE-5442 / RNV2-4). Light/dark colors, font size, and font family now set `--yv-reader-*` from `getTokens` and encoded font tokens instead of leaving the WebView on its own palette.

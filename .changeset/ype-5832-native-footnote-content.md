---
'@youversion/platform-react-native-expo-ui': minor
---

Footnote sheets render on native text. Marker taps still open the same sheet, with bold locators, verse superscripts, and right-to-left scripture direction (YPE-5832 / RNV2-5).

`BibleReader` draws its chapter with native text. Call `unstable_setReaderRenderer('native')` before the reader mounts. The previous WebView reader stays available with `unstable_setReaderRenderer('dom')` for comparison, and it will be removed when that comparison is done.

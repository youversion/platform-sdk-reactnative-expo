---
'@youversion/platform-react-native-expo-ui': minor
---

Footnote sheets render on native text. Marker taps still open the same sheet, with bold locators, verse superscripts, and right-to-left scripture direction (YPE-5832 / RNV2-5).

`BibleReader` can also render its body on native text, behind a temporary switch: `unstable_setReaderRenderer('native')`. The switch is for testing and goes away once native text is the default.

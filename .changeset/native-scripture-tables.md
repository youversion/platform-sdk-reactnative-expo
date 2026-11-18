---
'@youversion/platform-react-native-expo-ui': patch
---

Scripture tables (for example NIV Ezra 2) render as a native grid in `BibleReader`, `BibleTextView`, and `BibleCard`, laid out like the Swift SDK: no borders, short rows padded to the widest row, and the last column at the trailing edge. Cells keep verse numbers, footnotes, and highlights. A cell with no verse number, such as a count, is not part of a verse, so it is not highlighted or selected.

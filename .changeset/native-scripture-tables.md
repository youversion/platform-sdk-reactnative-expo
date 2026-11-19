---
'@youversion/platform-react-native-expo-ui': patch
---

Scripture tables (for example NIV Ezra 2) render as a native grid in `BibleReader`, `BibleTextView`, and `BibleCard`, laid out like the Swift SDK: no borders, short rows padded to the widest row, and the last column at the trailing edge. Cells keep verse numbers and footnotes. A cell with no verse number of its own, such as a count, belongs to the verse before it, so it highlights and selects with that verse.

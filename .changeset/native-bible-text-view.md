---
'@youversion/platform-react-native-expo-ui': minor
---

`dom` is no longer a prop on `BibleTextView` or `BibleReader`. Both draw scripture with native text. `BibleTextView` grows with its passage. `BibleCard` and `VerseOfTheDay` still embed the DOM text view.

Footnote markers on `BibleTextView` open the SDK footnote sheet unless you pass `onFootnotePress`. On web, with no handler, the markers are not drawn.

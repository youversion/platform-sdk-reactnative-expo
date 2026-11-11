---
'@youversion/platform-react-native-expo-ui': minor
---

`BibleTextView` and `BibleReader` draw scripture with native text. `dom` on both remains accepted but is deprecated and ignored — it will be removed in the next major. The view always sizes to its text, so `dom.matchContents: false` fill no longer applies. `highlightedVerses` is deprecated and ignored; cached highlights paint the passage. `BibleCard` and `VerseOfTheDay` still embed the DOM text view.

Footnote markers on `BibleTextView` open the SDK footnote sheet unless you pass `onFootnotePress`. On web, with no handler, the markers are not drawn.

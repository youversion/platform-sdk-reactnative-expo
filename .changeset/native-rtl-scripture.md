---
'@youversion/platform-react-native-expo-ui': patch
---

Right-to-left scripture in `BibleReader` and its footnote sheets starts at the right edge, on iOS and Android. A Selah pause sits at the end of its line. On Android, a paragraph that opens in the other direction's script now keeps the version's direction. The footnote heading in `BibleReader` reads the book title and chapter from the version. On Android, a verse underline no longer runs past a final footnote marker.

Direction comes from the version's `text_direction`, so `BibleReader` now requests `/v1/bibles/{id}/index` for each version, about 198 KB gzipped and cached for its `max-age`. Until that response arrives, or if the request fails, the letters in the text decide.

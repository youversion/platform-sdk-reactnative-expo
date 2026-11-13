---
'@youversion/platform-react-native-expo-ui': patch
---

Right-to-left scripture in `BibleReader`, `BibleTextView`, and their footnote sheets starts at the right edge, on iOS and Android. A Selah pause sits at the end of its line. On Android, a paragraph that opens in the other direction's script now keeps the version's direction. The footnote heading in `BibleReader` reads the book title and chapter from the version. On Android, a verse underline no longer runs past a final footnote marker.

Direction comes from the version's `text_direction`, so `BibleReader` and `BibleTextView` request `/v1/bibles/{id}/index` once per client and version (shared across mounts), about 198 KB gzipped and cached for its `max-age`. A host `scriptureDirection` skips that request. Until the index arrives, or if the request fails, the letters in the text decide.

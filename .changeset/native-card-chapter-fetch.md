---
'@youversion/platform-react-native-expo-ui': patch
---

`BibleCard` and `VerseOfTheDay` load the whole chapter and show only the requested verses, as the Swift SDK does. They now share the content cache with `BibleReader`. A Psalm title (for example "A psalm of David.") stays in a card that starts at verse 1, and in the shared and copied text of the verse beside it. `BibleCard` keeps a section heading when the next verse after it is in the range. `VerseOfTheDay` shows no section headings.

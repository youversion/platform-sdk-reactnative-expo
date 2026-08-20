---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

feat: paint host highlights on BibleTextView, BibleCard, and VerseOfTheDay

Subscribe those surfaces at chapter scope and always pass Highlight[] into the DOM so paint uses the native cache.

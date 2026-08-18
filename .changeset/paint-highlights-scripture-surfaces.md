---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

feat: paint host highlights on BibleTextView, BibleCard, and VerseOfTheDay

Subscribe those surfaces at chapter scope and always pass Highlight[] into the DOM so the latch is ready when platform-sdk-react#335 publishes.

Do not document paint-only highlights in the README until that pin; 2.6.2 ignores the unknown prop at runtime.

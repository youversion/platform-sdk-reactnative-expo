---
'@youversion/platform-react-native-expo-ui': minor
---

**Action required:** update `react-native-reanimated` to 4.5.3 or newer, then rebuild the native app. A JavaScript-only update is not enough.

- Verse of the Day and Bible Card draw the Bible App wordmark as an image. The translated "Bible App" text is gone. The `verse-of-the-day-attribution` and `bible-card-attribution` testIDs now point to that image, and their accessibility label is always the English "Bible App". Tests that look for the text or a translated label must change.
- Chapter numbers in the book picker stay the same size at every system text size.
- Reader bar labels (book and chapter, version, and the menu) do not grow past their normal size.

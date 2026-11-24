---
'@youversion/platform-react-native-expo-ui': minor
---

`BibleReader` takes `verseActions` to order, omit, or add buttons on the verse action sheet. A custom action has its own label and icon, and it receives the selected verses as merged ranges after the sheet closes. `BibleReader` and `BibleTextView` take `verseIndicatorStyle` and `onVerseIndicatorPress` to put a tappable marker on a verse number. Without these props, the reader works as before except verse numbers use the theme's `mutedForeground` (Figma Reader spec) instead of ink at 50% opacity, and the verse action sheet scrolls highlight swatches, Copy, and Share together in one row.

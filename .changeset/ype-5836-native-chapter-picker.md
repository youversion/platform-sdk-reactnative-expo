---
'@youversion/platform-react-native-expo-ui': minor
---

Replace the chapter picker's Expo DOM content with a native React Native picker and export `BibleChapterPicker` for custom presentation (YPE-5836).

`BibleChapterPickerSheet` no longer accepts a `dom` prop. The picker is native, so there is no Expo DOM surface to configure. This ships in the same major release as the Expo SDK 57 peer requirement.

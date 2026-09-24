---
'@youversion/platform-react-native-expo-ui': minor
---

Replace the version picker's Expo DOM content with a native React Native picker that keeps both the versions and language panels mounted on device (YPE-5834).

`BibleVersionPickerSheet` public props are unchanged. The `dom` prop remains accepted but is unused now that the picker is native.

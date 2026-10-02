---
'@youversion/platform-react-native-expo-ui': minor
---

Replace the version picker's Expo DOM content with a native React Native picker that keeps both the versions and language panels mounted on device (YPE-5834).

`BibleVersionPickerSheet` no longer accepts a `dom` prop. The picker is native, so there is no Expo DOM surface to configure. This ships in the same major release as the Expo SDK 57 peer requirement.

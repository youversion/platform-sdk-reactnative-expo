---
'@youversion/platform-react-native-expo-ui': minor
---

Export `DEFAULT_BIBLE_VERSION_ID` (3034, Berean Standard Bible) from the UI entry so consumers can reference the SDK's default Bible version instead of hardcoding the numeric ID. The constant now backs the internal `defaultVersionId` fallbacks for `BibleCard`, `BibleReader`, and the picker sheets.

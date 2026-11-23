---
'@youversion/platform-react-native-expo-ui': patch
---

BibleCard and BibleReader use the version’s trimmed `promotional_content` for attribution when its `copyright` is blank or missing. A nonblank `copyright` still takes precedence.

---
'@youversion/platform-react-native-expo-ui': patch
---

fix: YouVersionProvider holds children until bundled Inter registers, then native text always draws Inter. First paint waits on that local load. Theme toggles must not ellipsize button labels or drop a line from multi-line text.

---
'@youversion/platform-react-native-expo-core': patch
'@youversion/platform-react-native-expo-ui': patch
---

Abort an auth token request that does not finish within 10 seconds, so a stalled network cannot leave auth loading forever.

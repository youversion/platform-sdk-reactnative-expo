---
'@youversion/platform-react-native-expo-ui': minor
---

feat: expose BibleCard `maxWidth` (`number | '100%'`) and forward it to the web card (YPE-5197). Native does not apply it as a wrapper style. Scripture fill (`--yv-reader-max-width: none` on the painted section) is web-owned in platform-sdk-react#354; Expo does not copy that CSS. It lands when the WebView uses that UI build.

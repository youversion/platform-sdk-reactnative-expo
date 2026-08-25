---
'@youversion/platform-react-native-expo-ui': minor
---

feat: expose BibleCard `maxWidth` (`number | '100%'`) and forward it to the web card (YPE-5197). Pin `@youversion/platform-react-ui` to 2.10.0 so the WebView runs the published card (platform-sdk-react#354). Native only forwards the prop; scripture fill (`--yv-reader-max-width: none` on the painted section) stays web-owned.

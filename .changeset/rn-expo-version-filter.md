---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Add optional version filter lists to `YouVersionProvider`: `permittedVersionIds`, `excludedVersionIds`, and `permittedLanguageTags`. The UI provider forwards them through native wrappers into each DOM web `YouVersionProvider`. Pin `@youversion/platform-react-ui` and `@youversion/platform-core` to 2.8.0 so the web SDK enforces those lists in Expo DOM WebViews (YPE-4657/YPE-4658).

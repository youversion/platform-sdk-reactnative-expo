---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Add optional version filter lists to `YouVersionProvider`: `permittedVersionIds`, `excludedVersionIds`, and `permittedLanguageTags`. The UI provider forwards them through native wrappers into each DOM web `YouVersionProvider`. Filtering runs in the web SDK once a 4657-shaped `@youversion/platform-react-ui` is published and pinned.

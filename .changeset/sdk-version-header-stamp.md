---
'@youversion/platform-react-native-expo-ui': patch
---

Fix the `x-yvp-sdk` telemetry header to report the real package version on published builds. It previously shipped `ReactNativeSDK=Dev` for every consumer because the documented "release workflow rewrites the value" step never existed. A new `prepublishOnly` stamp (`scripts/stamp-sdk-version.cjs`) rewrites the version into the compiled build; builds that run from source still report `Dev`, so internal dev traffic stays distinguishable from partner traffic. See ADR 0012.

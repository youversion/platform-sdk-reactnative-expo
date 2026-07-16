---
'@youversion/platform-react-native-expo-ui': patch
---

Split dev and partner traffic in the `x-yvp-sdk` telemetry header. Every published build previously reported `ReactNativeSDK=Dev`, because the documented "release workflow rewrites the value" step never existed — so partner and internal traffic were indistinguishable. Published builds now report `ReactNativeSDK={version}` and source builds report `ReactNativeSDK={version}-dev`, matching the Web SDK's format so one telemetry rule (`endsWith('-dev')`) covers both SDKs. A `prepublishOnly` stamp (`scripts/stamp-sdk-version.cjs`) flips the build-channel flag in the compiled build and aborts the publish if it cannot confirm the channel. See ADR 0012.

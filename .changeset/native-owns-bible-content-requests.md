---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Native owns Bible content requests (YPE-5510). Core exposes a Bible Content Client and a required `fetchBibleContent` action on the provider context; the UI package weaves it under each DOM component's `fetch`, so eligible `/v1/bibles/*` requests cross the bridge and run natively with `X-YVP-Sdk: ReactNativeSDK=<version>` headers. The SDK version stamp moves from ui to core (`@youversion/platform-react-native-expo-core/sdk-version`).

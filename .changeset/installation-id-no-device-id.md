---
'@youversion/platform-react-native-expo-core': patch
---

Installation IDs are now a random UUID persisted in MMKV, not the device identifier (iOS IDFV / Android `ANDROID_ID`). Kids' apps that ship this SDK must not transmit persistent device IDs under COPPA; this matches the Swift, Kotlin, and React web SDKs. Existing stored installation IDs are left unchanged. `expo-application` is no longer a peer dependency of core. `YouVersionProvider` resolves the installation ID synchronously, so the `fallback` prop is unused.

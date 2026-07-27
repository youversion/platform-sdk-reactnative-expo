---
'@youversion/platform-react-native-expo-core': patch
---

Core now depends on `@youversion/platform-core@2.3.0` and includes an internal Highlights client wrapper (`createHighlightsApi`) that calls get/create/delete with an explicit access token and returns typed `Result` failures (`auth` for 401/403, `transient` otherwise). This surface is not exported from the package index yet — a later release will ship the public hook and API.

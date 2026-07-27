---
'@youversion/platform-react-native-expo-core': patch
---

Core now includes an internal MMKV highlights cache: synchronous per-user, per-chapter reads of the raw `Highlight[]` API shape, zod-validated so corrupt or legacy payloads read as a miss rather than throwing. A `deriveServerColors` projection maps cached highlights onto the displayed scope as the verse → hex color map (expanding range passage ids such as `JHN.3.16-18`), so passage ids survive a cold start and remain available for targeted deletes. Cached highlights are purged on sign-out and revoked-refresh alongside the rest of auth state. This surface is not exported from the package index yet — a later release will ship the public hook and API.

---
'@youversion/platform-react-native-expo-core': minor
---

The auth context now reads back which permissions the user actually granted. `useYVAuth()` exposes `grantedPermissions` (three-state: `null` = never requested, `[]` = requested and denied, populated = granted), `hasPermission(permission)`, and `invalidatePermissions()`. The grant is parsed off the OAuth app redirect, cached per user in MMKV, seeded synchronously on cold start, and cleared on sign-out. `AuthPermission` is now an open union (`KnownAuthPermission | (string & {})`) so server-side permission additions never read as denials.

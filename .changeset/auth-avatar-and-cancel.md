---
'@youversion/platform-react-native-expo-core': patch
---

Harden the auth flow against two upstream auth-page issues. `deriveUserInfo` now drops placeholder `profile_picture` values (e.g. `https://none/`) so consumers no longer receive a broken avatar URL. Sign-in now treats an `access_denied` callback (the auth page's Cancel button) as a clean cancel instead of throwing, with `state` validated first.

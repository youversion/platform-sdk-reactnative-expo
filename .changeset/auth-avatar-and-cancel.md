---
'@youversion/platform-react-native-expo-core': patch
---

Harden the auth flow against two upstream auth-page issues. `deriveUserInfo` now drops placeholder `profile_picture` values (e.g. `https://none/`) and any non-`https` avatar URL (iOS ATS and Android cleartext defaults block `http` image loads anyway) so consumers no longer receive a broken avatar URL. Sign-in now treats an `access_denied` callback (the auth page's Cancel button) as a clean cancel instead of throwing; `state` is still validated before any token exchange on the success path.

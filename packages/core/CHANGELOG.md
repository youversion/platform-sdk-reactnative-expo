# @youversion/platform-react-native-expo-core

## 0.10.0

### Patch Changes

- 9a5587d: Harden the auth flow against two upstream auth-page issues. `deriveUserInfo` now drops placeholder `profile_picture` values (e.g. `https://none/`) and any non-`https` avatar URL (iOS ATS and Android cleartext defaults block `http` image loads anyway) so consumers no longer receive a broken avatar URL. Sign-in now treats an `access_denied` callback (the auth page's Cancel button) as a clean cancel instead of throwing; `state` is still validated before any token exchange on the success path. Cached user info is now validated with a `zod` schema on read instead of being blindly cast, so a corrupt or legacy cache entry can no longer surface wrong-typed fields to consumers.
- 6ba0c15: Fix the top issues flagged by React Doctor. Replace relative barrel imports (`../storage`, `../lib`, `../hooks`, `../i18n`) with direct module paths to trim the app bundle and speed startup. Fix a stale-closure risk in the auth bootstrap effect by holding the latest `setAuthState`/`refreshToken`/`clearAuthState` in a ref instead of silencing the exhaustive-deps warning, preserving mount-only behavior. Reset version-picker state during render (previous-prop comparison) instead of in an effect, removing a brief stale-UI frame on sheet reopen in both the DOM picker and the native picker sheet. Drop a dead duplicate `READER_SETTINGS_PERSIST_KEY` export from core storage.

## 1.0.0

Initial release. Installation id, optional PKCE authentication, and storage adapters for the YouVersion Platform React Native (Expo) SDK.

### Added

- `YouVersionProvider` — installation id plus optional `auth` config (forwarded by the UI provider), and the `useYouVersion` hook
- PKCE OAuth via `useYVAuth`, with auth types `AuthConfig`, `AuthScope`, and `YVUserInfo`
- Token storage in `expo-secure-store`; token expiry and cached user info in MMKV via `mmkvStorage`

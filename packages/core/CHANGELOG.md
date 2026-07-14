# @youversion/platform-react-native-expo-core

## 1.0.0

Initial release. Installation id, optional PKCE authentication, and storage adapters for the YouVersion Platform React Native (Expo) SDK.

### Added

- `YouVersionProvider` — installation id plus optional `auth` config (forwarded by the UI provider), and the `useYouVersion` hook
- PKCE OAuth via `useYVAuth`, with auth types `AuthConfig`, `AuthScope`, and `YVUserInfo`
- Token storage in `expo-secure-store`; token expiry and cached user info in MMKV via `mmkvStorage`

**Auth hardening**

- User info drops placeholder and non-`https` avatar URLs (blocked by iOS ATS and Android cleartext defaults anyway), so consumers never receive a broken picture URL
- Canceling sign-in (`access_denied` callback) is treated as a clean cancel rather than an error
- Cached user info is validated with a zod schema on read, so a corrupt or legacy cache entry can't surface wrong-typed fields

# @youversion/platform-react-native-expo-core

## 1.1.0

### Minor Changes

- 89a4e50: Partners can now request YouVersion Platform permissions at sign-in. `AuthConfig` gains an optional `permissions` field typed by the new exported `AuthPermission` union (`'bibles' | 'highlights' | 'votd' | 'demographics' | 'bible_activity'`), and the PKCE flow appends each requested value to `/auth/authorize` as a repeated `requested_permissions[]` param — deduped and sorted, and omitted entirely when no permissions are configured. Permissions are deliberately kept separate from `scopes`: they are not OIDC scopes, and the auth server silently drops unknown values from `scope`, so requesting one there would grant nothing. This ships the request side only — reading back which permissions the user actually granted arrives in a later release.

## 1.0.0

### Major Changes

- ce283a0: Release 1.0.0 — the first stable release of the YouVersion Platform React Native Expo SDK.

  This is a milestone version bump marking the SDK's official 1.0 launch. There are no breaking API changes from 0.9.1; the major bump signifies the transition to a stable, publicly supported release line.

## 0.9.1

Initial release. Installation id, optional PKCE authentication, and storage adapters for the YouVersion Platform React Native (Expo) SDK.

### Added

- `YouVersionProvider` — installation id plus optional `auth` config (forwarded by the UI provider), and the `useYouVersion` hook
- PKCE OAuth via `useYVAuth`, with auth types `AuthConfig`, `AuthScope`, and `YVUserInfo`
- Token storage in `expo-secure-store`; token expiry and cached user info in MMKV via `mmkvStorage`

**Auth hardening**

- User info drops placeholder and non-`https` avatar URLs (blocked by iOS ATS and Android cleartext defaults anyway), so consumers never receive a broken picture URL
- Canceling sign-in (`access_denied` callback) is treated as a clean cancel rather than an error
- Cached user info is validated with a zod schema on read, so a corrupt or legacy cache entry can't surface wrong-typed fields

### Package surface

- Imports are restricted to the package root via an `exports` map — import everything from `@youversion/platform-react-native-expo-core`. Deep imports (e.g. into `build/`) are not part of the public API.

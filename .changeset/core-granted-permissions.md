---
'@youversion/platform-react-native-expo-core': minor
---

`useYVAuth()` now reports which YouVersion Platform permissions the signed-in user granted, and can ask for one at any time.

Three additions to the auth context:

- **`grantedPermissions: AuthPermission[] | null`** — what this device believes the signed-in user granted, scoped to that user and persisted in MMKV so it is available on the first render after a cold start. `null` means _unknown_ (signed out, or nothing recorded) and is deliberately distinct from `[]` ("we asked and were granted nothing").
- **`hasPermission(permission)`** — the synchronous read the highlight flow gates on.
- **`requestPermission(permission)`** — YouVersion's just-in-time grant. Opens the hosted consent page in an auth browser session and records what comes back, resolving to `{ kind: 'granted', permissions }`, `{ kind: 'cancel' }`, or `{ kind: 'failure', message }` (also exported as `RequestPermissionResult`). `granted` means the exchange completed, not that your permission was in it — check `permissions`. The grant is discarded if the signed-in user changed while the browser was open.

The mirror is **optimistic**: sign-in seeds it from the permissions the app requested, because the sign-in callback carries no grant echo to read. The server is still the ultimate check — a highlight write that comes back 401/403 drops the `highlights` grant, so the next attempt prompts instead of failing the same way. Signing in replaces the recorded set; signing out clears every user's.

`AuthPermission` is now an **open** string union (the listed values still autocomplete, unknown ones type-check) matching the Swift SDK, so a permission minted after this release round-trips intact instead of being dropped or forcing a major version. The closed list is still available as `KnownAuthPermission`. This is not a breaking change for code that passes or reads permission values; only an exhaustive `switch` over `AuthPermission` needs a default case.

---
'@youversion/platform-react-native-expo-core': minor
---

Partners can now request YouVersion Platform permissions at sign-in. `AuthConfig` gains an optional `permissions` field typed by the new exported `AuthPermission` union (`'bibles' | 'highlights' | 'votd' | 'demographics' | 'bible_activity'`), and the PKCE flow appends each requested value to `/auth/authorize` as a repeated `requested_permissions[]` param — deduped and sorted, and omitted entirely when no permissions are configured. Permissions are deliberately kept separate from `scopes`: they are not OIDC scopes, and the auth server silently drops unknown values from `scope`, so requesting one there would grant nothing. This ships the request side only — reading back which permissions the user actually granted arrives in a later release.

---
'@youversion/platform-react-native-expo-core': minor
---

`signIn` accepts extra OAuth scopes and merges them with the scopes already configured. `useYVAuth()` exposes `grantedScopes`, the scopes the token response returned. `useNotes().create` accepts empty `content`, which saves a passage without note text.

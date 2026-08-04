---
'@youversion/platform-react-native-expo-core': minor
---

The auth context now reports which permissions the user granted. `useYVAuth()` adds three members:

- `grantedPermissions` lists the permissions the user granted.
- `hasPermission()` reports whether one permission is in that list.
- `invalidatePermissions()` clears the cached grant.

`grantedPermissions` has three states:

- `null` means the app never requested permissions.
- `[]` means the app requested permissions, and the user denied them.
- A populated list means the user granted those permissions.

The SDK handles the grant as follows:

- It reads the grant from the OAuth app redirect.
- It caches the grant per user in MMKV.
- It loads the cached grant on cold start.
- It clears the grant on sign-out.

`AuthPermission` is now an open union (`KnownAuthPermission | (string & {})`). As a result, `AuthConfig.permissions` and `hasPermission()` accept a permission string that this SDK version does not know about. `grantedPermissions` is typed `readonly string[] | null`, so it keeps every value the server returns.

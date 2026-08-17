# 14. The cached permission grant is a hint, not an authority

Date: 2026-08-03
Amended: 2026-08-11 — the identity cache carries the same residual.

## Status

Accepted

`granted_permissions` is cached per user in MMKV and seeded on the first render so `hasPermission` is correct on a cold start. The clear cannot throw: a storage failure must not break sign-out. So a failed removal can leave a stale grant that reseeds on the next launch.

The cache is a **hint**. Use it to choose UI and to skip a redundant prompt. The server enforces. A write 401/403 stays authoritative and drives `invalidatePermissions`. Privileged actions also gate on `isAuthenticated` / `isLoading`, because the seed precedes session validation.

Clearing stays best-effort. No extra write is layered on a store that just refused a write.

| Failure | Behavior |
| --- | --- |
| Normal clear | Entry removed |
| Removal fails | Stale grant accepted — bounded by the server |

The second row needs an MMKV removal to fail. The worst outcome is a skipped prompt, then a request the server denies. Reviewers will keep rediscovering this. It is a decision, not a missing `try`.

`cachedUserInfo` is purged by the same best-effort removal and seeds `userInfo` the same way. A stale identity is not bounded by the server. The **bootstrap clear** bounds it: SecureStore removals are awaited and they took, so `loadTokens()` finds no refresh token, `clearAuthState` runs again, and `setIdentity(null)` drops the identity from memory. The exposure is the window before that resolves. Every cold start already has that window, with `isAuthenticated` false and `isLoading` true.

`userInfo` decides what to paint on the first frame. `isAuthenticated` / `isLoading` decide whether anyone is signed in. Privileged work gates on the latter.

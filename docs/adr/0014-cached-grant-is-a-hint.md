# 14. The cached permission grant is a hint, not an authority

Date: 2026-08-03

## Status

Accepted

## Context

`granted_permissions` arrives on the OAuth app redirect and is cached per user in MMKV (YPE-3709), seeded synchronously in a `useState` initializer so `hasPermission` answers correctly on the first render after a cold start — the same pattern `userInfo` already follows.

Invalidation is expressed as an _absence_ (`clearGrantedPermissions` removes the key) in a store that is permitted to fail silently — the clear cannot throw, because a storage failure must not break sign-out over a cache that only seeds one render. So a removal failure can leave a stale grant that reseeds on the next cold start. Making deletion more reliable cannot close that class (each mitigation narrows the window and invites the next finding); making the cache authoritative means moving the grant into the async token record and giving up the synchronous first-render seed the subtask exists to provide.

## Decision

The cached grant is a **hint**. It makes the first render correct in the common case; it is not an authorization decision.

- `hasPermission` / `grantedPermissions` are advisory: use them to choose UI and skip a redundant prompt.
- The server is the enforcement point. A write's 401/403 stays authoritative and drives `invalidatePermissions`, so a stale hint is corrected rather than trusted twice.
- Privileged actions also gate on `isAuthenticated` / `isLoading`, since the seed precedes session validation.

Clearing stays best-effort, with no mitigation layered on top:

| Failure       | Behavior                                         |
| ------------- | ------------------------------------------------ |
| Normal clear  | Entry removed                                    |
| Removal fails | **Stale grant accepted — bounded by the server** |

The second row is the accepted residual: it requires an MMKV removal to fail, and its worst outcome is a skipped prompt followed by a request the server denies.

## Consequences

The blast radius of a stale grant is a redundant request and a re-prompt, never access the user does not have. That holds only while the write path treats the server's 401/403 as authoritative and corrects the cache through `invalidatePermissions`; a future change acting on `hasPermission` without that corrective edge voids this ADR and reopens the authoritative-cache option.

Reviewers will keep rediscovering the residual, because in isolation `clearGrantedPermissions` looks like a bug. It is a decision, recorded here so it can be disagreed with on the merits rather than re-patched.

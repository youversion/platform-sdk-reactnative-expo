# 14. The cached permission grant is a hint, not an authority

Date: 2026-08-03

## Status

Accepted

## Context

`granted_permissions` arrives on the OAuth app redirect and is cached per user in MMKV (YPE-3709), seeded synchronously in a `useState` initializer so `hasPermission` answers correctly on the first render after a cold start. That synchronous seed is the point of the subtask — it mirrors how `userInfo` already behaves and avoids a blank first frame.

Review of the subtask surfaced a recurring class of finding, raised three separate times against three successive fixes:

1. `clearGrantedPermissions` swallowed MMKV removal failures, so an invalidated grant survived and was reseeded on the next cold start.
2. A `DELETED_MARKER` tombstone, written when the removal failed, fixed that only while the store remained writable; if the removal and the overwrite both failed, the entry survived intact.
3. A read-time writability probe closed _that_ only while the store stayed broken. If storage recovered before the next mount, the probe succeeded and the surviving grant was accepted.

Each fix was correct and each narrowed a real window. None of them closed the class, because they all attacked the same mechanism — making deletion more reliable — while the requirement is an invariant: **a grant must never outlive the session it belongs to.**

**Fixes 2 and 3 were subsequently reverted** (they are in the branch history, not the tree). They were roughly 155 lines of source and tests defending a case this ADR concludes is bounded anyway, and the probe in particular gave `loadCachedGrantedPermissions` a write side effect on every cold start. Keeping them would have meant carrying machinery whose own justification this document withdraws.

The reason the mechanism cannot deliver the invariant is that revocation is expressed as an _absence_, in a store that is permitted to fail silently. `clearGrantedPermissions` cannot throw — a storage failure must not break sign-out over a cache that only seeds one render. So an absence can always be faked by a store misbehaving at the wrong moment, and there will always be a next window.

Two exits exist, and they are mutually exclusive:

- **Make the cache authoritative.** The grant then has to be written and cleared atomically with the session, which means living in the token record in `expo-secure-store`. `loadTokens` is async, so the synchronous first-render seed is lost — contradicting YPE-3709 as written.
- **Make the cache non-authoritative.** Accept that a stale grant is possible under storage failure, and ensure nothing security-relevant depends on the cached answer alone.

## Decision

The cached grant is a **hint**. It exists to make the first render correct in the common case, not to gate access.

Concretely:

- `hasPermission` and `grantedPermissions` are advisory. They may be used to decide what UI to show and whether to skip a redundant prompt. They are not an authorization decision.
- The server is the enforcement point. A permission the client believes it holds is still rejected with 401/403 if the grant is not real, and that rejection is what drives `invalidatePermissions`.
- The pre-flight introduced in YPE-3709's third subtask is the gate for privileged actions. It must not treat a cached `true` as sufficient, and it must gate on `isAuthenticated` / `isLoading` as well, since the seed precedes session validation.

Clearing stays best-effort, with no mitigation layered on top:

| Failure       | Behavior                                         |
| ------------- | ------------------------------------------------ |
| Normal clear  | Entry removed                                    |
| Removal fails | **Stale grant accepted — bounded by the server** |

The second row is the accepted residual. It requires an MMKV removal to fail, and its worst outcome is a client that skips a prompt and issues a request the server denies. Two mitigations were built for it and both were reverted: the trade was more code and a surprising write-on-read for a risk this decision already bounds.

This is deliberately the simplest thing that can work, because the alternative was demonstrated. Every attempt to make deletion more reliable produced a narrower version of the same finding, and each one invited the next.

## Consequences

The blast radius of a stale grant is a redundant request and a re-prompt, never access the user does not have. That is only true while the pre-flight actually re-checks; if a future change makes `hasPermission` sufficient on its own, this ADR is void and the authoritative-cache option has to be revisited.

Reviewers — human or automated — will keep rediscovering the residual, because reading `clearGrantedPermissions` in isolation it looks like a bug. It is a decision, recorded here so it can be disagreed with on the merits rather than re-patched.

Separately, and not part of this trade-off: `signIn` guards against out-of-order completion with an epoch ref, so a superseded attempt applies nothing. That is an ordinary async-correctness fix, not a consequence of the cache being a hint — identity and grant must come from the same attempt regardless of how much authority the cache carries.

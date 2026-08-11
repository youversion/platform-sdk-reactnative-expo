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

## Amendment (2026-08-11): the identity cache carries the same residual

`cachedUserInfo` is purged by the same best-effort removal, in the same `clearAuthState`, and seeds `userInfo` in the same synchronous initializer. Review raised the sibling finding: a removal that does not take leaves the departed user's record readable, the next mount seeds it, and `useHighlights` — which keys its own synchronous cache read off `userInfo.id` — paints that user's highlights.

The mechanism is real and the decision is the same, but it cannot borrow this ADR's reasoning: a stale grant is bounded by the server, and a stale identity is not. Nothing server-side stops the SDK painting a departed user's name or their cached highlights. What bounds it is the **bootstrap clear**. SecureStore is a different store, its removals are awaited, and they took — so `loadTokens()` finds no refresh token, `clearAuthState` runs again, and `setIdentity(null)` drops the identity from memory whether or not the store accepts the removal. The exposure is the window before that resolves, which every cold start already has, with `isAuthenticated` false and `isLoading` true throughout.

Nothing is layered on top of that bound, because nothing can be:

- Every candidate mitigation — a fallback overwrite with a value the loader rejects, a tombstone, a retry — is another **write** into the store that just refused a write. Both realistic asymmetric states (a read-only instance, a full disk) serve reads and fail every write, so each fallback fails alongside the removal it was meant to cover.
- The exception is not even the operative signal: `MMKV.remove` returns `false` rather than throwing on a read-only instance, so the record can survive with nothing caught. The `try`/`catch` in `clearAuthState` exists to keep a throw from aborting the token clearing below it; it is not a detector, and reading it as one overstates what it can promise.
- Corroborating the seed against the store sign-out did clear means awaiting SecureStore, which is precisely the synchronous first-render seed this ADR and `useHighlights` are both built on.

So the cached identity is a hint on the same terms as the grant: `userInfo` decides what to paint on the first frame, `isAuthenticated` / `isLoading` decide whether anyone is signed in, and privileged work gates on the latter. `AuthProvider — mount` pins the bound in both directions — with a healthy store the record is gone, and with a store that refuses removals the identity and grant still leave state at bootstrap while the record survives.

## Consequences

The blast radius of a stale grant is a redundant request and a re-prompt, never access the user does not have. That holds only while the write path treats the server's 401/403 as authoritative and corrects the cache through `invalidatePermissions`; a future change acting on `hasPermission` without that corrective edge voids this ADR and reopens the authoritative-cache option.

Reviewers will keep rediscovering the residual, because in isolation `clearGrantedPermissions` looks like a bug. It is a decision, recorded here so it can be disagreed with on the merits rather than re-patched.

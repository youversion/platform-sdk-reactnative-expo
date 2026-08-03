---
'@youversion/platform-react-native-expo-core': minor
---

A user who taps a highlight color before they are signed in, or before they have granted the `highlights` permission, now gets their highlight instead of losing it. Add `useHighlightPermissionFlow({ versionId, book, chapter })`, which composes `useHighlights` with the auth context and guards `apply` behind the missing step: it holds the pending highlight in memory, runs sign-in and/or the just-in-time consent grant, and applies the highlight on the way back. `remove` is unwrapped and passes straight through — a user with visible highlights already has the grant.

The hook returns the underlying `useHighlights` result untouched (render `highlights` from it as before), plus `isConfirming` to drive a consent prompt, `confirm()` / `decline()` to answer it, and `flowError` for the one thing worth a toast. `apply` resolves with the write's own `HighlightWriteOutcome` when a write was issued, `noop` when the user abandoned the flow, and an `error` when the flow itself failed — so a cancel or a decline never reads as something going wrong.

The branch point is a **pre-flight permission read, not a write's 401/403**: branching on the failure reason would burn a failed round-trip before every first highlight. A write refused with `reason: 'auth'` anyway means the cached grant was stale, so the grant is invalidated and the user is re-prompted — **exactly once**, never in a loop. Every dismissal path discards the pending highlight cleanly, a grant that comes back without `highlights` does not write, and a browser round-trip that lands after the reader changed chapters cannot resurrect a highlight for a passage the user has left.

Also adds `ensureFreshToken()` to the auth context: the leeway-gated refresh, made public and awaited before the permission read. Without it an expired token 401s, the 401 reads as `auth`, and `auth` reads as "stale grant" — so an expired token would present to the user as a request to grant a permission they already granted.

Requires `auth` on `YouVersionProvider` and the `highlights` permission (a permission, never a scope). With no `auth` configured the flow behaves exactly as signed out, and says so once in development. The localized consent sheet ships separately, once its strings land in the SDK's generated locale files.

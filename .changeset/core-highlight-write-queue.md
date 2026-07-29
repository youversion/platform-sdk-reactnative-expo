---
'@youversion/platform-react-native-expo-core': minor
---

Highlight writes that fail on the network are now queued and retried instead of quietly vanishing.

A highlight applied or removed with no connection stays painted, is persisted to MMKV, and retries with exponential backoff (2s doubling, capped at 30s) until it lands — surviving an app kill, which the reference implementation does not. Only network-shaped failures retry: a rejected payload is dropped, and a permission failure still routes to the just-in-time consent prompt rather than looping.

`useHighlights()` gains `hasPendingOperations`, and `useYVAuth()` gains `hasPendingHighlightOperations` plus `discardPendingHighlights()`, so a host that owns its own sign-out can warn before throwing unsaved work away. Both are true while a write is on the wire, not only while the queue is non-empty.

`HighlightWriteOutcome` is unchanged in shape, but `failedVerses` now means something different by reason: for `transient` those verses are queued and **still painted**; for every other reason their paint has been reverted, as before.

Signing out discards the queue and bumps a generation counter, so a write already in flight for the departed user can never land on the next account.

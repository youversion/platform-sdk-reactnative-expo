# 18. The highlight write queue is unbounded desired state

Date: 2026-08-05
Amended: 2026-08-08 — `expo-network` is a core peer. Connectivity is a trigger, not a gate.

## Status

Accepted

A tap without service used to revert and die with the in-memory overlay. The queue is the durable record of that tap.

**A queue entry is one verse's desired end state, not an operation.** `{ local, server }` per verse, keyed per user and Highlight Scope. A later tap overwrites `local`. An entry whose two sides agree is dropped, so apply-then-remove offline leaves nothing behind. `server` is what a refused write reverts to. A refetch on rejection fails in the two cases that need it: a 401 GET fails the same way, and a relaunch has no in-memory server truth.

**Cached Highlights are the paint. Every write goes through the queue.** The cache holds what the reader shows, unsent writes included. The queue holds what still needs sending. That is why the Highlight Overlay and the ownership tokens in [ADR 0013](0013-native-highlights-optimistic-layer.md) were deleted: a settling write touches only entries that still ask for what it sent.

**The queue is unbounded: no size cap, no TTL, no attempt budget.** A per-verse entry is small. A TTL only fires after a long stretch offline, and that stretch is a normal Bible-app case. Discarding a month of highlights on day 31 is worse than a dormant device waking up. A 5xx the server never accepts lives for the life of the install and is removable only by sign-out. Per-entry backoff makes that cheap. A code change alone does not clear entries that existing installs already hold.

**Local intent wins a conflict.** `Highlight` has no id and no timestamp, so "newer" cannot be computed. If both devices are online and this tap comes last, local-wins is the outcome.

**One drop path: a 401/403 that survives a forced refresh and one retry.** A permanent local-only phantom is worse than a silent un-paint. The retry must go out under a token the refresh actually minted. A `refresh-failed` force drops nothing. Sign-out purges the queue with the rest of the user data, best-effort, under [ADR 0014](0014-cached-grant-is-a-hint.md).

**MMKV is written queue first, cache second.** A crash between the two leaves a write that is owed but not painted. The next mount re-applies the queue over the cache. The other order leaves a phantom with no route back.

**`expo-network` wakes the drain. It does not gate it.** The first draft rejected a connectivity library. That window was mis-sized: a write outlives the chapter that made it, so "no reader mounted" is every moment between two foregrounds. When service returns, the rising edge lands a backed-off write. A wrong or missing connectivity answer costs a delayed attempt, never a skipped one.

The drain is owned by core's `YouVersionProvider`. A write for John 3 must land while the reader is in Romans 8. Offline highlighting works because the permission pre-flight reads the cached grant ([ADR 0014](0014-cached-grant-is-a-hint.md)). If that read becomes authoritative, offline highlighting stops.

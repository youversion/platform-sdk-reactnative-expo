# 17. The highlight write queue is unbounded desired state, drained without a connectivity library

Date: 2026-08-05

## Status

Accepted

## Context

A highlight tapped without service is lost. `useHighlights` paints optimistically, the request fails at the network, `settle` reverts the paint, and `apply` resolves `{ status: 'error', reason: 'transient' }`. The intent exists only in an in-memory overlay and a promise chain, so the app does not have to die for the write to disappear — losing the network is enough.

[ADR 0013](0013-native-highlights-optimistic-layer.md) anticipated the fix and named the cost it expected to pay: _"F1's offline write queue will need exactly that machinery"_ — merging confirmed writes into cached ranges, which drags range-splitting onto the write path. `CONTEXT.md` reserved the boundary from the other side, telling readers not to persist a **Pending Highlight** because "that is F1's offline queue, a different thing."

This is that queue. Five questions had answers a future reader will find surprising, and each has a cheaper-looking alternative.

**What a queue entry is.** The obvious model is a log of the operations the user performed, replayed in order. It is what the existing promise chain does and it is the most faithful record of what happened.

**Whether a connectivity library is required.** "Retry when service returns" reads as a subscription problem, and `@react-native-community/netinfo` is the standard answer.

**How the queue is bounded.** Every durable queue is expected to have a size cap, a TTL and an attempt budget.

**Who wins a conflict.** `Highlight` is exactly `{ version_id, passage_id, color }` — no id, no timestamp — so "which change is newer" cannot be computed from the API.

**Whether every write goes through it.** A queue that handles only failures means two paint sources with a handoff between them; a queue that handles every write means one.

## Decision

**A queue entry is one verse's desired end state, not an operation.**

`{ [verse]: { local, server } }`, persisted per user + **Highlight Scope**. `local` is where the user wants the verse — a color, or `null` for no highlight. `server` is where the server had it before the user started editing, captured once by the first write to that verse and preserved when a later write overwrites `local`.

Enqueueing the same verse overwrites rather than appends, so yellow → remove → blue collapses to a single entry and one request. An entry whose two sides agree asks for nothing and is dropped, so applying then removing offline leaves nothing behind — a case the op-log model sends to the server as a DELETE for something it never had. That rule is intrinsic to the entry, which matters because there is no stored copy of server truth to compare against (see the next decision).

`server` is what a rejected write is reverted to. The alternative — refetch on rejection — does not work in the two cases that need it most: a 401 rejection means the GET will fail the same way, and a rejection after a relaunch has no in-memory server truth left to fall back on.

On drain, contiguous same-color verses collapse into ranged POSTs through the existing `collapseVerseRuns`, so the wire format is unchanged.

**Cached Highlights are the paint, and every write goes through the queue.**

The cache holds what the reader shows, unsent writes included, so a relaunch paints them before anything touches the network. The queue holds what still needs sending. Neither stores raw server truth; `server` on each entry carries the only piece of it anything needs.

Making the cache optimistic is what allows the **Highlight Overlay** to be deleted rather than persisted. Under the alternative — cache stays server-truth-only, overlay re-derived from the queue at mount — the paint is a merge of two records on every render, and the overlay is a second copy of the queue that happens not to survive a relaunch.

Deleting the overlay also retires [ADR 0013](0013-native-highlights-optimistic-layer.md)'s in-memory ownership tokens. Their job — stopping a settling write from clobbering paint a newer write put down — is now done by comparing values: a settling write only touches entries still asking for what it sent. The behavior is preserved; the mechanism is not. See that ADR's update for why the value comparison is sufficient where an operation log would have needed the token.

Two entry fields were considered for this and rejected. A per-write sequence number is what the ownership token becomes once it has to survive `JSON.stringify` — unnecessary, because a stale settle cannot reach an entry whose `local` no longer matches what it sent, and two writes carrying the same color express the same intent, so either may retire it. A `sent` flag ("the server accepted this, keep painting until a GET confirms") would persist across a relaunch and make the drain re-send an already-accepted write; reconciliation stays in memory instead.

**No connectivity library. A drain attempt is its own probe.**

There is no separate "is the network up" question to answer: you attempt the write, and success is the answer. What remains is cadence, and three signals cover it — provider mount, `AppState` returning to active, and any successful highlights GET, which is free live proof that the network is up while a reader is on screen. A capped backoff covers the rest.

NetInfo would close one narrow window: the user is in the app, no reader is mounted, and service returns, so the drain fires up to one backoff interval late instead of instantly. Nothing is lost, only delayed. That is not worth a required native peer dependency and a dev-client rebuild for every consumer, on an SDK that today needs no networking native module at all. A failed attempt while offline is also cheap — with no route to the host the request fails locally and fast, so probing is close to free.

**The queue is unbounded: no size cap, no TTL, no attempt budget.**

A per-verse entry is a few dozen bytes, so a user who highlighted every verse in the Bible offline (~31,000) would still be under a couple of megabytes in MMKV. A size cap would guard against nothing. Entries are therefore keyed per user + scope rather than held in one global blob, so a tap rewrites one chapter's slice instead of the whole queue.

A TTL was considered and rejected on product grounds. It only ever fires for a device that has been offline for the length of the TTL — and for a Bible app, long offline stretches in low-connectivity places are a normal use case, not an edge case. Discarding a month of someone's highlights on day 31 is a worse failure than the case a TTL prevents (a long-dormant device waking up and re-adding highlights deleted elsewhere).

An attempt budget for 5xx entries was specified and then deliberately removed. **The consequence is real and is not a bug:** a payload the server permanently rejects with a 5xx lives in the queue for the life of the install and is removable only by signing out. Per-entry backoff makes it cheap — one request an hour rather than one per drain tick — and entries are independent, so a stuck entry never blocks another. If this is ever revisited, note that existing installs will already hold such entries; a code change alone does not clear them.

**Local intent wins a conflict; the queue is skipped only when server truth already satisfies it.**

With no timestamps, any rule is a policy rather than a comparison. Local-wins produces the same outcome the user would get if both devices were online and this tap came last. The alternative — assuming a differing server color means someone else changed it more recently, and discarding the offline intent — silently destroys a tap the user actually made on this device.

**One exception to "nothing is ever dropped": a definitive auth rejection.**

A 401/403 that survives a forced token refresh and one retry is the server stating this write will never be accepted. Keeping it would leave the verse painted on this device forever, showing a highlight that exists nowhere else — and with no pending-state surface on the public API, the user could never learn it is not real. A permanent local-only phantom is worse than a silent un-paint, so the entry is dropped. This keeps auth entirely out of the queue's business, matching the tap-time rule that a 401/403 reverts and reports rather than parking.

Note that a dead session does not reach this path: `refreshToken` clears auth state on a revoked refresh token. Sign-out should purge the queue alongside the highlights cache and the grant cache; the queue's distinct MMKV prefix means it does not today, which is a decision to make deliberately rather than inherit from a prefix match.

**MMKV is written queue first, cache second.**

The two writes are not atomic. Dying between them leaves a write that is owed but not painted, which the next mount repairs by re-applying the queue over the cache. The other order leaves one painted that nothing will ever send — a phantom highlight with no route back to correctness.

## Consequences

- **`HighlightWriteOutcome` gains `{ status: 'queued'; verses }`** — painted, persisted, not yet landed. `ok` keeps meaning "landed server-side", which is what existing consumers already read it as. Shipped as a minor: no existing status changes meaning and every existing branch behaves identically, so only an exhaustive `switch` with no default is affected. The changeset should say so loudly.
- **A batch that reached nobody skips its reconciling GET.** Every settled write is followed by one GET; a write that could not reach the server changed nothing server-side and has nothing to reconcile, so spending a request on a network that just refused one only produces a fetch error for what was a successful park.
- **A refusal outranks a park in a mixed batch.** If part of a batch was refused and part was queued, the outcome is the `error`, because `useHighlightPermissionFlow` branches on `reason` and that branch must still fire. The queued verses stay queued regardless — the outcome reports the actionable failure, not everything that happened.
- **The queue is provider-owned, not hook-owned.** A write for JHN 3 must land after the user has navigated to ROM 8, and draining needs a token, which lives in `AuthProvider`. The drain therefore needs a way to tell mounted readers an entry was dropped; the subscribable-store shape that provides it lands with the drain rather than ahead of it.
- **Offline with a missing `highlights` grant fails cleanly rather than queueing.** The data-exchange mint fails before any browser opens, the **Pending Highlight** is discarded, nothing paints and nothing queues. Queueing a write the SDK has no reason to believe is permitted only defers the un-paint to the drain, where it would be unexplained.
- **The ordinary offline path works because of [ADR 0014](0014-cached-grant-is-a-hint.md).** The pre-flight reads the _cached_ grant, which is a hint, so a granted user offline sails through the permission flow to a write that fails at the network and queues. If that read ever became authoritative, offline highlighting would stop working for everyone.

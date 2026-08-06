# 13. Native highlights are the optimistic layer, with colour-aware overlay retirement

Date: 2026-07-27

## Status

Accepted

## Context

`useHighlights` (YPE-3708) is the native data layer for Bible highlights: it paints from the MMKV cache on first render, applies and removes optimistically, reconciles against the server, and reverts what fails.

The web SDK already solved this once. `bible-reader-highlights-machine.ts` in `platform-sdk-react` is an xstate statechart that unifies the highlight auth/dialog flow with an optimistic write queue. It is internal-only and imports web-specific modules, so it cannot be reused directly — but its semantics are hard-won and re-deriving them would reproduce its bugs.

Two constraints frame the decision:

- **This is the only optimistic layer in the stack.** W1's ADR for the reader is explicit that the controlled `highlights` prop is pure projection with no optimistic echo. If native does not own it, nothing does.
- **Output crosses the native/DOM bridge as a serialized prop**, so state transitions that change nothing must return the same object.

## Decision

Port the web machine's overlay math into a pure, React-free module (`packages/core/src/highlights/optimistic.ts`) and drive it from a hook. Three semantics are adopted deliberately; one diverges.

### Adopted: per-op ownership tokens

Every write allocates a fresh token object and stamps the verses it claims. A settling write only touches verses it _still_ owns, compared by object identity.

Without this: tap yellow on verse 16; before that POST returns, tap green on 16; then yellow's POST fails. Yellow's revert would delete the overlay entry and wipe the green the user is currently looking at, over a failure that has nothing to do with it.

### Adopted: a promise chain instead of a write queue

The web machine maintains an explicit queue because xstate cannot `await`. A promise chain is inherently FIFO and needs no queue state. Optimistic paint still lands synchronously; only the network writes serialize.

### Adopted: web's range pattern on the wire

Applies collapse contiguous verses into one ranged POST per run (`[16,17,18,20]` → `JHN.3.16-18` + `JHN.3.20`); removes issue one DELETE per verse, never a range, because range DELETE is not supported server-side. Both paths route through `collapseVerseRuns`, so switching removes to one-per-run is a single call site if that changes.

### Diverged: colour-aware retirement of remove overlays

Web's `reconcileOverlay` never retires a remove entry:

```ts
if (entry.op !== 'apply') continue // remove entries never retire (vapor fix)
```

That fixes a real bug — a stale read replica echoing back the colour just deleted repaints the verse for a beat ("vapor") — but the suppression is opaque and unbounded. It holds until a reset path runs, so a _new_ colour set on another device stays invisible until the user navigates away and back. Web's own header states this as an accepted cost.

`ReconcileEntry` already carries the colour, and web simply ignores it for removes. So we keep the fix and drop most of the cost:

```ts
function shouldRetire(entry: ReconcileEntry, serverColor: string | undefined): boolean {
  if (entry.op === 'apply') return serverColor === entry.color
  // Remove: the vapor case is the server echoing back the colour we deleted.
  // A DIFFERENT colour cannot be an echo of that deletion — it is newer data.
  return serverColor !== undefined && serverColor !== entry.color
}
```

The failure mode this introduces is strictly narrower than the one it fixes: verse was green → user set yellow → user removed it → a replica stale enough to still report _green_ retires the overlay and briefly paints green. That needs the server two steps behind rather than one.

**Reverting to web's behaviour is `return false` in the remove branch.** It is a single named function for exactly that reason.

### Not ported: the permission flow

Web's settle routes a 401/403 into invalidate → re-stash pending highlight → re-prompt. That is C3 (YPE-3709). Here, failure handling stops at revert + classify, and the returned `HighlightWriteOutcome.reason === 'auth'` is C3's branch point.

## Consequences

- Native and web agree on what the user sees mid-write, and the shared vocabulary (`claim` / `settle` / reconcile / ownership token) survives in both codebases. Anyone diffing the two files finds the divergence documented rather than having to reverse-engineer whether it was deliberate.
- The colour-aware rule needs both directions pinned by tests, because it reads like a bug in each direction: a stale GET echoing the deleted colour must **not** resurrect the verse, and a GET reporting a different colour **must** retire the overlay.
- Two smaller decisions follow from the same "one optimistic layer" premise and are recorded here because reviewers ask about both:
  - **`error` is fetch-only.** Writes report once, through their return value. With one error slot, a transient write failure would evict a fetch error that is still true (the reader is showing stale cached data _because_ the GET failed), and a consumer with both a call-site handler and an error banner would render two UIs for one event.
  - **Writes hold through the token-loading window** on `accessToken !== null || !isLoading`, never on `isLoading` alone — `postTokenEndpoint` has no `AbortController`, so a hung network can leave `isLoading` true indefinitely. Without the hold, a cold-start write returns `not-signed-in` for a genuinely signed-in user, which is the exact value C3 branches on to launch a sign-in prompt.
- The cache stores server truth only. A _confirmed_ write would be safe to persist — this is a cost decision, not a correctness one: merging a remove into cached ranges drags range-splitting onto the write path to fix a flash that requires the app to die inside a one-request window. F1's offline write queue will need exactly that machinery.

## Amendment (F1, YPE-3717): the write queue landed, and `transient` no longer reverts

The deferred offline queue is no longer deferred. `packages/core/src/highlights/queue.ts` persists **Pending Operations** to MMKV under `yvp.highlightQueue.<userId>`, and `useHighlights` routes failures into it instead of reverting.

What changed against the decision above:

- **A `transient` failure keeps its paint.** `settle` still owns the revert, but it is now called with only the verses the queue is _not_ taking. `HighlightWriteOutcome.failedVerses` therefore means two different things by `reason`: queued-and-still-painted for `transient`, reverted for everything else. That is documented on the type; it is the one place the union's shape does not tell the whole story.
- **Classification is per-unit for re-queueing, per-batch for reporting.** The caller is still told the batch's worst reason (`auth` > `invalid` > `transient`), but one malformed passage id must not strand the verses that merely hit a flaky network, so `retryableVerses` decides what re-queues from each unit's own error.
- **Ownership tokens now guard the queue as well as the paint.** A verse the user has re-tapped in another colour is dropped from the failing write's re-queue (`selectOwnedVerses`) _and_ from any op already on disk (`supersedePendingVerses`). Without the second half the overlay would be right and the account would be wrong: a yellow retry firing after green's POST leaves the server on yellow.
- **The generation counter is part of the hook's identity key.** A discard (sign-out, or `discardPendingHighlights()`) bumps it, which reseeds optimistic state through the same render-time reset a chapter change uses — dropping unconfirmed paint and clearing `writeIntent`, so a result that lands after the discard settles onto nothing and cannot re-queue onto the next account.
- **The queue is not `better-result`'s retry helper.** That retries inside one awaited call: it does not survive an app restart, does not persist, and has no generation concept. Adopting it would mean a new direct dependency in `packages/core` and closing the `src/result.ts` seam. The seam stays open.
- **What is still deferred:** the cache continues to store server truth only. A write that fails, gets queued, and is then killed with the app repaints from the _queue_, not the cache — `initialStateFor` re-claims pending ops on mount. The sub-second window this does not cover is an app kill during the very first request, before anything is queued.

Swift's queue is memory-only, which is a known gap on their side. Persisting ours is the one place the RN implementation deliberately does more than the reference, because Android kills backgrounded apps aggressively enough to make that gap routine rather than rare.

# 13. Native highlights are the optimistic layer, with color-aware overlay retirement

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

### Diverged: color-aware retirement of remove overlays

Web's `reconcileOverlay` never retires a remove entry:

```ts
if (entry.op !== 'apply') continue // remove entries never retire (vapor fix)
```

That fixes a real bug — a stale read replica echoing back the color just deleted repaints the verse for a beat ("vapor") — but the suppression is opaque and unbounded. It holds until a reset path runs, so a _new_ color set on another device stays invisible until the user navigates away and back. Web's own header states this as an accepted cost.

`ReconcileEntry` already carries the color, and web simply ignores it for removes. So we keep the fix and drop most of the cost:

```ts
function shouldRetire(entry: ReconcileEntry, serverColor: string | undefined): boolean {
  if (entry.op === 'apply') return serverColor === entry.color
  // Remove: the vapor case is the server echoing back the color we deleted.
  // A DIFFERENT color cannot be an echo of that deletion — it is newer data.
  return serverColor !== undefined && serverColor !== entry.color
}
```

The failure mode this introduces is strictly narrower than the one it fixes: verse was green → user set yellow → user removed it → a replica stale enough to still report _green_ retires the overlay and briefly paints green. That needs the server two steps behind rather than one.

**Reverting to web's behaviour is `return false` in the remove branch.** It is a single named function for exactly that reason.

### Not ported: the permission flow

Web's settle routes a 401/403 into invalidate → re-stash pending highlight → re-prompt. That is C3 (YPE-3709). Here, failure handling stops at revert + classify, and the returned `HighlightWriteOutcome.reason === 'auth'` is C3's branch point.

## Consequences

- Native and web agree on what the user sees mid-write, and the shared vocabulary (`claim` / `settle` / reconcile / ownership token) survives in both codebases. Anyone diffing the two files finds the divergence documented rather than having to reverse-engineer whether it was deliberate.
- The color-aware rule needs both directions pinned by tests, because it reads like a bug in each direction: a stale GET echoing the deleted color must **not** resurrect the verse, and a GET reporting a different color **must** retire the overlay.
- Two smaller decisions follow from the same "one optimistic layer" premise and are recorded here because reviewers ask about both:
  - **`error` is fetch-only.** Writes report once, through their return value. With one error slot, a transient write failure would evict a fetch error that is still true (the reader is showing stale cached data _because_ the GET failed), and a consumer with both a call-site handler and an error banner would render two UIs for one event.
  - **Writes hold through the token-loading window** on `accessToken !== null || !isLoading`, never on `isLoading` alone — `postTokenEndpoint` has no `AbortController`, so a hung network can leave `isLoading` true indefinitely. Without the hold, a cold-start write returns `not-signed-in` for a genuinely signed-in user, which is the exact value C3 branches on to launch a sign-in prompt.
- The cache stores server truth only. A _confirmed_ write would be safe to persist — this is a cost decision, not a correctness one: merging a remove into cached ranges drags range-splitting onto the write path to fix a flash that requires the app to die inside a one-request window. F1's offline write queue will need exactly that machinery.
  - **Update ([ADR 0017](0017-highlight-write-queue.md)):** it did not, and the premise was reversed. **Cached Highlights** now hold the paint, unsent writes included, and the range-splitting predicted here is avoided anyway — `selectHighlights` already emits per-verse, so persisting it is lossless. The window named above is closed: the queue entry is written before the request goes out, so a write that dies with the app mid-request is owed on the next launch.

- **Update ([ADR 0017](0017-highlight-write-queue.md)): the ownership token is retired, the guarantee is not.** With the queue holding every unconfirmed write, the **Highlight Overlay** and its `writeIntent` map were deleted; a settling write now finds its entries by value, touching only those still asking for what it sent.

  The token was necessary here because an overlay entry carried no record of what it was for — two writes were distinguishable only by identity. A queue entry carries its own desired state, so the yellow-then-green race resolves on the data: yellow's rejection reads `local` as green, and leaves it alone. The one case value comparison cannot separate — two writes carrying the same colour — needs no separating, because they express the same intent and either may retire the entry.

  The `claim` / `settle` / reconcile vocabulary shared with web narrows to reconcile alone (`paint` / `confirm` / `restore` replace the rest). Anyone diffing the two files should read this before assuming the guarantee was dropped along with the mechanism.

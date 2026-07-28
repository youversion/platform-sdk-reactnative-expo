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

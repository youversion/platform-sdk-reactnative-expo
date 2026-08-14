# 16. The highlight permission flow branches on a pre-flight read, and re-prompts once

Date: 2026-08-05

## Status

Accepted

A tap before sign-in or before the `highlights` grant must survive the missing step. Four choices here look cheaper the other way.

**Branch on the cached grant. Treat `reason: 'auth'` as the corrective path, not the primary one.** Reason-first issues a request the SDK already knows will fail before every first highlight. [ADR 0014](0014-cached-grant-is-a-hint.md) still holds: a 401/403 invalidates the hint and re-prompts.

**Refresh the token on the send path, not in front of the tap.** Both orderings make the token current at send time. Only the send path keeps the paint on the tap. Wait only while `isLoading && !isAuthenticated`. A token in hand is settled.

**Re-prompt exactly once, then go terminal.** A second `auth` refusal after a fresh grant is a server that is still refusing. More consent cannot fix that. Looping the hosted page on a repeated 403 is the worst reading of it.

**Keep the Pending Highlight in memory, and let its scope govern it.** Native OAuth returns to the same process, so `sessionStorage` and a TTL solve a web problem. Verse numbers mean nothing without the chapter they were tapped in. Anything replayed after an await is compared against the claimed scope. A generation token cannot cover a straight-through write that comes back `auth`, because no flow exists yet.

**Hand-roll the reducer.** `xstate` adds a dependency to a published package for a five-state machine. Every event that is invalid for the current step is a no-op. That is what stops a late browser return from resurrecting a discarded highlight.

Ordinary highlights do not go through the reducer. Only a flow is exclusive. An overlapping tap during one resolves `transient`. Cancels and declines resolve `noop`. A user choice is not an error.

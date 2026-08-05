# 16. The highlight permission flow branches on a pre-flight read, and re-prompts once

Date: 2026-08-05

## Status

Accepted

## Context

A user taps a highlight color before they are signed in, or before they have granted the `highlights` permission. The tap has to survive whatever step is missing (YPE-3709, YPE-4355), mirroring Swift's `BibleReaderViewModel.addHighlightOrStartPermissionFlow`.

Three questions had answers that are not obvious from the code, and each has a cheaper-looking alternative a future reader will reach for.

**Where the flow branches.** The SDK can learn the user is not permitted in two places: a pre-flight read of the cached grant, or a write that comes back 401/403. Reason-first is tempting because [ADR 0014](0014-cached-grant-is-a-hint.md) already says the cache is only a hint, so the failure is the authoritative signal either way.

**How many times to re-prompt.** [ADR 0014](0014-cached-grant-is-a-hint.md) requires the write path to correct a stale hint through `invalidatePermissions`. Correcting it means asking the user again, and asking again on a signal that can repeat invites a loop.

**Where the pending highlight lives.** The web SDK stashes an equivalent intent in `sessionStorage` with a TTL, because a web OAuth redirect destroys the page.

## Decision

**Branch on the pre-flight read. Treat a `reason: 'auth'` write as the corrective path, not the primary one.**

`useHighlightPermissionFlow` awaits `ensureFreshToken()`, reads `hasPermission('highlights')`, and chooses sign-in, consent, or a straight-through write from that. Reason-first would issue a request the SDK already knows will fail before every first highlight, so the common case would pay a failed round-trip to learn something the cache could answer.

The pre-flight order is load-bearing. An expired token 401s, a 401 classifies as `auth`, and `auth` reads as a stale grant, so skipping the refresh would present an expired token to the user as a request to grant a permission they already granted.

**Re-prompt exactly once, then go terminal.**

The reducer carries a `retried` flag from `confirming` onward. A write refused with `reason: 'auth'` after the user has just granted the permission calls `invalidatePermissions()` and re-prompts once. A second refusal resolves as a flow error. More consent cannot fix a server that is still refusing, and looping the hosted consent page on a repeated 403 is the worst available reading of it.

**Keep the pending highlight in memory, and let its scope govern it.**

`openAuthSessionAsync` returns to the same live process, so `sessionStorage` and a TTL solve a problem native does not have. The pending highlight lives inside reducer state as `{ color, verses, scope }`.

`scope` is not decoration. Verse numbers mean nothing without the chapter they were tapped in, and the hook's `useHighlights` reference follows the reader. Anything replayed after an await is compared against the scope it was claimed under before it may write:

| Window                                                | Guard                                         |
| ----------------------------------------------------- | --------------------------------------------- |
| A live flow spans a scope change                      | Render-time `RESET` plus the generation token |
| The pre-flight refresh is out                         | `pending.scope` versus the current scope      |
| A straight-through write is out and comes back `auth` | Claimed scope versus the current scope        |

The last two are the ones a generation token cannot cover: no flow exists yet, so there is no waiting caller to abandon.

**Hand-roll the reducer.** Swift's equivalent is about sixty lines of view-model state, and `useHighlights` already serializes writes through a promise chain. `xstate` would be a dependency in a published package for a five-state machine.

## Consequences

Every event invalid for the current step is a no-op. That is the mechanism keeping a browser round-trip that lands after a `RESET` from resurrecting a discarded highlight, so it must not be "tidied" into a smaller reducer that throws or logs on unexpected events.

Ordinary highlights deliberately do not go through the reducer. Modelling every tap as an exclusive flow step would serialize concurrent writes that `useHighlights` supports and users do constantly. Only a flow is exclusive; an overlapping tap during one resolves `transient`.

Cancels and declines resolve `{ status: 'noop' }`. A user choice is not an error, and `flowError` carries only terminal flow failures, so a consumer can wire it straight to a toast.

The accepted residual is the one ADR 0014 already named: a grant the server disagrees with costs the user one extra consent prompt. This flow bounds that at one prompt per tap rather than removing it.

`ensureFreshToken` joins an in-flight refresh rather than skipping it, so awaiting it does mean the token is current. A failed refresh still leaves the old token in place, which is why the corrective path exists at all and must not be removed as redundant.

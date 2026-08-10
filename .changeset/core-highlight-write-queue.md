---
'@youversion/platform-react-native-expo-core': minor
---

Highlights made offline survive and land on their own.

A highlight tapped without service keeps its paint instead of un-painting and reporting an error, is persisted per user and chapter so it is still there after a force-quit and relaunch, and reaches the user's account on its own once service returns.

**`HighlightWriteOutcome` gains a member: `{ status: 'queued'; verses: number[] }`.** No existing status changes meaning, and every existing branch behaves identically, so this is additive for anything using `if`/`switch` with a `default`. **An exhaustive `switch` with no `default` will stop type-checking** until the new case is handled — treat `queued` as a success for anything that paints, since the highlight is on screen and owed to the server. That one widened union is the whole reason this is a minor rather than a patch, and it is the only API change this entry carries.

Which failures park and which revert:

- **Unreachable, or a 5xx** — the paint stands and the write parks. `apply` and `remove` resolve `{ status: 'queued', verses }`.
- **Refused: 401, 403, or any other 4xx** — unchanged. The paint reverts to what the server has and the outcome reports as before, so the `reason: 'auth'` branch that `useHighlightPermissionFlow` depends on is untouched.

`status: 'error'` with `reason: 'transient'` therefore no longer reaches consumers from the write path — a server that cannot be reached now resolves `queued`.

Writes are persisted before they are sent, so the paint never has a gap and an app killed mid-request still owes the write. At mount the paint comes from the highlights cache with the queue re-applied over it, which repairs a crash between those two writes. A second tap on a verse that already has a parked write overwrites it rather than stacking, and a write whose end state matches what is already stored cancels out without ever becoming a request — so applying and then removing the same verse offline leaves nothing behind.

`queued` reports the write you just made, not the verse's history, so **it repeats**: tapping a verse that is still parked resolves `queued` again, and the outcome does not tell you whether that verse was already waiting. Show "saved offline" once by holding that in your own state — a batch can mix a parked verse with fresh ones, and a verse parked yellow then tapped green is a new write rather than a repeat, so there is no single flag the SDK could hand back that would be true.

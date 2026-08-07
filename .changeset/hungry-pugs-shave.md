---
'@youversion/platform-react-native-expo-core': minor
---

Highlight writes now survive losing service. A write that cannot reach the server keeps its paint, is persisted per user and chapter, and is still there after a force-quit and relaunch — instead of un-painting and reporting an error.

**`HighlightWriteOutcome` gains a member: `{ status: 'queued'; verses: number[] }`.** No existing status changes meaning, and every existing branch behaves identically, so this is additive for anything using `if`/`switch` with a `default`. **An exhaustive `switch` with no `default` will stop type-checking** until the new case is handled — treat `queued` as a success for anything that paints, since the highlight is on screen and owed to the server.

`status: 'error'` with `reason: 'transient'` no longer reaches consumers from the write path; a server that cannot be reached now resolves `queued`. A server that _refuses_ a write (401, 403, or any other 4xx) is unchanged: the paint reverts and the outcome reports as before, so the `reason: 'auth'` branch that `useHighlightPermissionFlow` depends on is untouched.

Nothing drains the queue yet — a queued write lands on the next successful write to that verse. Automatic retry on reconnect ships separately.

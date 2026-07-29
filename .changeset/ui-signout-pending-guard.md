---
'@youversion/platform-react-native-expo-ui': minor
---

Signing out with unsaved highlights now warns first.

`YouVersionAuthButton` and the Bible reader's in-WebView toolbar both check `hasPendingHighlightOperations` before signing out, and show a native alert when highlight writes are still waiting to reach the server. Confirming discards that work — it does not try to flush it, which on the dead network that caused the backlog would hang the sign-out the user just asked for. Cancelling leaves the user signed in with the queue intact.

`BibleReader`'s `onHighlightError` also changes meaning rather than shape: a `transient` outcome now means "queued and retrying", not "didn't save". The highlight stays painted and survives an app kill, so render it as a pending or offline hint rather than a failure.

Hosts that call `useYVAuth().signOut()` themselves can read the same `hasPendingHighlightOperations` flag and build their own warning.

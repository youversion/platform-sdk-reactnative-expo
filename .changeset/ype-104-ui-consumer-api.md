---
'@youversion/platform-react-native-expo-ui': minor
---

YPE-104 UI deltas on the highlights stack.

## BibleReader

- **`refreshHighlights()` ref handle** — call `reader.current?.refreshHighlights()` to re-fetch highlights for the reader's current scope (for example after a screen refocus).
- **`onHighlightError(error)`** — optional callback for offline or queued highlight writes. Fires for `{ status: 'queued' }` and `{ status: 'error', reason: 'transient' }` only; auth, invalid, ok, and noop outcomes stay silent. The `HighlightWriteError` type is exported from the UI package.

## Sign-out guard

- **`BibleReader`** and **`YouVersionAuthButton`** now ask before signing out, matching the Swift SDK. When the highlight write queue still holds unsent work, the copy escalates to "Save your highlights?"; confirming calls `signOut()` only — core clears the queue and cache on sign-out.
- **Web bypass** — on `Platform.OS === 'web'`, both surfaces call `signOut()` directly because React Native Web's `Alert.alert` is a no-op.
- **`useSignOutGuard`** is exported for apps that need the same confirmation on their own sign-out UI.

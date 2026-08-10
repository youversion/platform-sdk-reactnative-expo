---
'@youversion/platform-react-native-expo-core': patch
---

A highlight the server will never accept stops being painted, instead of sitting on the device forever as a highlight that exists nowhere else.

When a parked write comes back 401 or 403, the drain forces a token refresh and states the write once more. The ordinary expired-token case is cured by that and lands normally. Only a **second** auth refusal, under a freshly minted token, drops the entry — the verse reverts to the color the server had, and un-paints on a reader that is still mounted, with no remount and no user action.

A write the server will never accept is reachable two ways: a consumer calling `useHighlights` directly without `useHighlightPermissionFlow`, or a `highlights` grant revoked between the tap and the drain.

Nothing else drops. Network failures, 5xx, and non-auth 4xx still retry indefinitely on their widening backoff, as before. A forced refresh that fails, or one that ends the session the write belongs to, drops nothing — sign-out purges the queue itself, and the drain must not be what decides a departed user's write was refused for good. Dropping one entry never touches another, in the same chapter or any other.

No public API changes.

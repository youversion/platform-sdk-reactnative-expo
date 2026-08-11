---
'@youversion/platform-react-native-expo-core': patch
---

Fix `signOut()` rejecting on a device store that refuses writes. Clearing the session ends by saving null tokens, and that save wrote the cached token expiry unguarded, so a storage failure threw — after the in-memory session and the stored tokens were already gone. The caller saw a rejected promise for a sign-out that had in fact completed. The expiry is a cache over the tokens, which are the record, so it can no longer fail the save; a lost expiry costs one token refresh, because a missing one already reads as expired.

The same failure leaves the cached user info readable, and the next launch seeds it back before auth settles. That residual is unchanged and now recorded: the tokens live in a different store, their removal is awaited and takes, so the launch finds no refresh token and clears the identity from memory regardless of what the cache still holds. Nothing is layered on top, because every candidate mitigation is another write into the store that just refused one. `isAuthenticated` and `isLoading` remain the signals to gate on; a cached identity or permission grant is a hint about the first frame.

No public API changes.

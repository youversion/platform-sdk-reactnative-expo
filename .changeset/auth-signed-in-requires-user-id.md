---
'@youversion/platform-react-native-expo-core': major
---

Signed-in sessions now always carry a non-empty YouVersion user id.

- **`YVUserInfo.id`** is required (was optional). A session without a valid non-empty `sub` in the id_token is rejected at sign-in and cleared on cold start, including malformed stored id_tokens.
- **`getAccessToken()`** `{ status: 'ok', userId }` is now `string` (was `string | null`). When status is `'ok'`, the token and user id were read in the same synchronous block and both belong to the signed-in user.

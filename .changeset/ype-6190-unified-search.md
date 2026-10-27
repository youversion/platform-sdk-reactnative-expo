---
'@youversion/platform-react-native-expo-core': minor
---

Add `useUnifiedSearch` for one verse, topic, and image search. An image hit (`YouVersionImageSearchResult`) is `{ id, passageId }`. `fields` may include `images`. A change of app key, API host, or installation id drops the previous snapshot (YPE-6190). This depends on `@youversion/platform-core` 2.16.0.

A search HTTP 404 is `not-found`. Any other 4xx except 401, 403, 408, and 429 is `invalid-parameter` and includes `status`. Input rejected before the request is `invalid-parameter` with no `status`. This applies to `useSearch` as well as `useUnifiedSearch`. An app that switches on every `SearchApiError` kind needs a `not-found` case. 408 and 429 stay `transient`.

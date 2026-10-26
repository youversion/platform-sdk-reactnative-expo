---
'@youversion/platform-react-native-expo-core': minor
---

Add `useUnifiedSearch` for one verse, topic, and image search. An image hit (`YouVersionImageSearchResult`) is `{ id, passageId }`. `fields` may include `images`. A change of app key, API host, or installation id drops the previous snapshot (YPE-6190).

A search HTTP 404 is `not-found`. Any other 4xx except 401, 403, 408, and 429 is `invalid-parameter`. 408 and 429 stay `transient`.

---
'@youversion/platform-react-native-expo-core': minor
---

Bible content is cached on device (YPE-5262). The Bible Content Client reads a per-version MMKV store before fetching and writes each 2xx body back with the lifetime the response's `Cache-Control` declares — `max-age` less `Age`, seven days when no usable `max-age` is present, and no write at all for `no-cache`, `no-store`, or a lifetime of zero — so previously read chapters, pickers, and BibleCard content render without a network, including offline. Content is scoped to the app key and survives sign-out.

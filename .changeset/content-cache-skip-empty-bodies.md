---
'@youversion/platform-react-native-expo-core': patch
---

The Bible content cache no longer stores an empty response body. Before, one empty `200` for a version's books or index was served from disk for up to a day, and the chapter picker showed an error that Retry could not clear. Entries that an earlier version already stored empty are treated as missing and refetched.

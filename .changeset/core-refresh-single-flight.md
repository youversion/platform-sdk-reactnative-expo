---
'@youversion/platform-react-native-expo-core': patch
---

Fix a token refresh already in flight being skipped rather than joined. `refreshToken` tracked its in-flight request with a boolean, so a second caller returned immediately instead of waiting, resolving on the very token the refresh existed to replace. It now holds the request as a promise and hands it to the second caller, matching how in-flight data-exchange requests are already shared.

The common trigger is ordinary: the app comes to the foreground, the `AppState` listener starts a refresh, and the user acts a moment later. Anything auth-sensitive in that window read the expired token and got a 401. `refreshNow()` and the new `ensureFreshToken()` both benefit, so awaiting either now means the token is the current one.

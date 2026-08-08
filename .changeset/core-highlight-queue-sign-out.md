---
'@youversion/platform-react-native-expo-core': minor
---

Signing out now drops every highlight write still waiting to reach the server, so a write parked on one account can never land on the next one signed in on the device. It happens in the same routine that already clears the highlights cache and the granted-permission cache, which a revoked refresh token also runs — a dead session takes the parked writes with it.

The purge takes every user's parked writes, not only the departing user's. One user is signed in at a time, so an entry under any other id was already left behind by an earlier departure and has no session that could ever send it.

Entries stay keyed per user for as long as a user is signed in, and a user change part-way through a drain stops the pass rather than sending the departed user's writes under the new token.

No public API changes.

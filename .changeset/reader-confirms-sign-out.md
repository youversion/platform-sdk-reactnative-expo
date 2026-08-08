---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

`BibleReader` now asks before it signs anyone out, matching the Swift SDK.

Sign-out from the reader's user menu raises a native alert instead of signing out on the spot. Sign-out is destructive here — it drops the access token, the cached user, the granted permissions, the highlights cache, and every highlight write still waiting to reach the server — and the menu item sits one tap away from the reader.

The alert has two variants:

- **Nothing unsent.** "Are you sure you want to sign out from YouVersion?" / "You'll need to sign in again to access your highlights." with **Sign Out** and **Cancel**.
- **Unsent highlight writes.** "Save your highlights?" / "Some of your highlights haven't been saved yet, and they will be lost if you sign out. Do you want to sign out anyway?" with **Sign out anyway** and **Cancel**. This is what the user sees when a highlight was made offline, or while the service was unreachable, and the drain has not landed it yet.

All four strings are localized through the SDK's own catalog.

There is nothing to enable and no new prop. The confirmation is the reader's, and it is the only place the SDK offers sign-out — `YouVersionAuthButton` and `useYVAuth().signOut()` are unchanged and still sign out immediately, which is what a host app's own confirmation flow needs.

**Web signs out unprompted.** React Native Web's `Alert.alert` is a no-op, so confirming there would leave the menu item doing nothing at all.

Core adds one export, `hasQueuedHighlightWrites(userId)`, the question the reader asks to choose a variant: does this user have highlight writes the server has not taken? It reads the write queue directly and never throws — an unreadable store answers "nothing to lose" rather than breaking the gesture that raises the prompt.

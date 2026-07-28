---
'@youversion/platform-react-native-expo-ui': minor
---

`BibleReader` now asks for consent when a highlight tap needs it, instead of doing nothing.

A signed-out user who taps a colour gets the "Sign in with YouVersion" sheet; a signed-in user who hasn't granted the `highlights` permission gets a just-in-time native alert leading to the hosted consent page. Either way the tap is held and applied on success, so the verse never has to be re-selected — and after a permission grant the chapter reloads, so highlights created on youversion.com or in the YouVersion app appear alongside it.

Every cancellation exit ("No Thanks", swipe-down, backdrop, alert Cancel, denying on the consent page) discards the held highlight. With no `auth` configured on `YouVersionProvider`, a colour tap stays a silent no-op.

`expo-application` is now a peer dependency, used to put the app's own display name in the sign-in sheet's copy. It requires no dev-client rebuild — `@youversion/platform-react-native-expo-core` already required it.

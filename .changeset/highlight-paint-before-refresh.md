---
'@youversion/platform-react-native-expo-core': patch
---

Fix a highlight not painting until the token refresh in front of it finished. `useHighlightPermissionFlow.apply` awaited `ensureFreshToken()` before it reached the code that paints. A refresh is due when the access token sits at or inside its 60-second leeway, or when the `AppState` foreground listener already started one. In both cases the user tapped a color and watched nothing happen for a full token round-trip.

The refresh moved into `useHighlights.runWrite`, next to the existing auth-settled wait. The token is still current when the request goes out, which is the property that keeps a 401 from being misread as a stale permission grant, but the optimistic claim now paints on tap. `remove` and any direct `useHighlights` consumer pick up the same freshness guarantee, which previously only `apply` had.

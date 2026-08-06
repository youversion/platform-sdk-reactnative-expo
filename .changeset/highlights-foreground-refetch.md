---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Highlights created elsewhere — in the YouVersion app, on youversion.com, or on another device — now appear when the user comes back to the app, instead of waiting for a remount or a chapter change.

`useHighlights` subscribes to `AppState` and re-fetches on `background → active`. Only that transition: on iOS `expo-web-browser` parks the app in `inactive` during sign-in and the just-in-time consent grant, and both of those already re-fetch on the identity change they cause, so firing on `inactive` would double-fetch every consent round-trip. The listener needs no gating of its own — the existing fetch already skips an app that never requested the `highlights` permission, skips a signed-out user, and joins whatever request is in flight.

`BibleReader` accepts a `ref` exposing `refreshHighlights()` (new exported type `BibleReaderHandle`) for the trigger the SDK deliberately does not detect: navigation focus. Detecting it would force `@react-navigation/native` on every consumer as a peer, so the host calls it from `useFocusEffect` instead. The returned promise is core's own `refresh` — it never rejects (fetch failures land in `error`) and concurrent calls join the one request in flight, so it is safe to await for a pull-to-refresh spinner.

No new dependencies and no native modules: **no dev-client rebuild is needed** to pick this up.

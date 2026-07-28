---
'@youversion/platform-react-native-expo-ui': minor
---

The highlight swatches in `BibleReader`'s verse drawer now write.

Tapping a color applies it to the selected verses and tapping a checkmarked color removes it, both painting instantly and persisting to the signed-in user's YouVersion account. Removing one color leaves other colors on those verses intact.

Every tap is gated against the chapter currently on screen, so an intent that lands after the reader has already moved on is dropped rather than painted into the new chapter.

New public prop: `onHighlightError`, called when a write fails in a way the user should know about and a retry may help. Payload errors are logged instead — the user can't act on them. A tap by a signed-out user, or by one who hasn't granted the `highlights` permission, is silent for now; the sign-in sheet and the just-in-time permission prompt land next.

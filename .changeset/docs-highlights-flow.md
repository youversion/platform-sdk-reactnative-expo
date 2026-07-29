---
'@youversion/platform-react-native-expo-core': patch
'@youversion/platform-react-native-expo-ui': patch
---

Document highlights end to end.

The READMEs now cover what `BibleReader` does on its own (cached paint, the sign-in sheet and just-in-time consent prompt, the offline retry queue, the sign-out warning), the `highlights` **permission** requirement and why it belongs in `permissions` rather than `scopes`, reading grants back with `grantedPermissions` / `hasPermission` / `requestPermission`, and the new `onVerseSelect` / `onCopy` / `onShare` / `onHighlightError` props. `expo-clipboard` is listed with the other native peers, alongside the dev-client rebuild every native peer needs.

Two corrections: the core README no longer shows a `highlights` prop on `BibleReader` — the Web SDK's controlled mode is an internal mechanism, not a supported surface, and `useHighlights` is the escape hatch for hosts building their own UI — and the note that granted permissions "are not exposed yet" is gone, because they are.

No code changes.

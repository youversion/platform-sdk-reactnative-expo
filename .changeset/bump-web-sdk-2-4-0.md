---
'@youversion/platform-react-native-expo-core': patch
'@youversion/platform-react-native-expo-ui': patch
---

Update the Web SDK dependencies to 2.4.0 — `@youversion/platform-core` (core, from 2.3.0) and `@youversion/platform-react-ui` (UI, from 2.2.0), which brings `@youversion/platform-core` and `@youversion/platform-react-hooks` 2.4.0 with it, so a single copy of each resolves across the workspace.

What this pulls in that matters here:

- `BibleReader`'s controlled highlights mode (`highlights?: Highlight[]`, `onVerseSelect`, `onHighlightApply`, `onHighlightRemove`) — the contract the native highlight bridge is built against.
- A core `ApiClient` fix: an empty-body 2xx (what a successful highlight DELETE returns) is now read as success rather than a failure.
- The data-exchange primitives (`DataExchangeClient`, `buildDataExchangeUrl`, `parseDataExchangeCallback`, `parseGrantedPermissions`) used by the just-in-time `highlights` permission grant.

No public API changes in either package.

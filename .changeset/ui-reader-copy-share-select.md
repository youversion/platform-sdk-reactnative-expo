---
'@youversion/platform-react-native-expo-ui': minor
---

`BibleReader` gains three public props: `onVerseSelect`, `onCopy`, and `onShare`.

Copy and Share in the verse drawer now work on device. Both were browser-only before — the Web SDK falls back to `navigator.clipboard` and Web Share, neither of which is reliable inside an Expo DOM WebView. The SDK now handles them natively: Copy writes the curly-quoted verse text plus reference to the system clipboard, and Share opens the native share sheet. Pass `onCopy` / `onShare` to take either one over; the consumer handler wins and the SDK fallback doesn't run. Failures are swallowed, matching how a dismissed share sheet already behaves.

`onVerseSelect` fires on every selection change with a bridge-safe payload (`versionId`, `book`, `chapter`, `verses`, per-verse `passageIds`), including `verses: []` whenever a selection clears. It is an observation of the reader's own selection — nothing you return changes it.

**`expo-clipboard` is a new peer dependency and requires a dev-client rebuild.** Install it (`npx expo install expo-clipboard`) and rebuild — a JS-only reload cannot link native code, so an existing dev client will redbox with `Cannot find native module 'ExpoClipboard'`:

```bash
npx expo prebuild --clean -p ios && pnpm build:ios   # or -p android
```

---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Verse actions in `BibleReader` are now a native bottom sheet, matching the Swift and Kotlin SDKs.

Selecting a verse raises a native sheet with the localized reference, the highlight color swatches, Copy, and Share. It replaces the in-WebView popover the previous release switched off, so the actions that release removed are back as native UI. There is nothing to enable: no new prop, no opt-in.

**Action required. Install `expo-clipboard` and rebuild your dev client.** `expo-clipboard` is a new peer dependency, and it backs the Copy fallback. It is a native module, so a JS-only reload cannot link it. `expo-application` is also now a UI peer dependency. Apps that already use the core package have it.

```bash
npx expo install expo-clipboard expo-application
```

What the sheet does:

- **Highlight swatches.** A remove circle for every color present on any selected verse, then an apply circle for each of the five palette colors. Writes go through the same highlights service as `useHighlights`, so the passage repaints at once and the sheet closes.
- **Sign-in and permission prompts.** The sheet asks a signed-out user, or one without the `highlights` permission, for exactly what is missing. It then applies their color choice, with no reselecting of the verse. This needs an `auth` config that requests the `highlights` permission. Without one, the swatches behave as they do for a signed-out user.
- **Copy and Share.** They fall back to `expo-clipboard` and React Native's `Share`. Two new optional props on `BibleReader`, `onCopy` and `onShare`, take either one over. Both receive the `BibleReaderShareData` this package already re-exports.

**The sheet has no backdrop, and that is deliberate.** A backdrop intercepts the second verse tap, and extending a selection one verse at a time is the point. The consequence is that a tap outside does not dismiss the sheet. To dismiss it, swipe down, deselect the verses, or act on the sheet. Every themed bottom sheet in the SDK now draws an upward drop shadow, so a sheet without a backdrop still separates from the content behind it.

`onVerseSelect` and `clearSelectionSignal` are unchanged and still public. The first fires alongside the sheet rather than instead of it. The second closes the sheet along with the selection.

**Web keeps the React Web SDK's verse action popover.** Native verse actions are not available on web in this release. `NativeSheet` renders nothing there, so suppressing the popover would leave the reader with no verse action UI at all. The popover is what web gets until the native surface reaches it.

Nothing changes in the core package's public API. It versions alongside UI.

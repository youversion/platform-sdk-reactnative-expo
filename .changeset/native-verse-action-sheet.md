---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Verse actions in `BibleReader` are now a native bottom sheet, matching the Swift and Kotlin SDKs.

Selecting a verse raises a native sheet carrying the localized reference, the highlight color swatches, Copy, and Share. It replaces the in-WebView popover the previous release switched off, so the actions that release removed are back — as native UI. Nothing to enable: no new prop, no opt-in.

**Action required for existing consumers: install `expo-clipboard` and rebuild your dev client.** It is a new peer dependency (the Copy fallback) and is a native module, so a JS-only reload cannot link it. `expo-application` is also now a UI peer dependency; apps already using the core package have it.

```bash
npx expo install expo-clipboard expo-application
```

What the sheet does:

- **Highlight swatches.** A remove circle for every color present on any selected verse, then an apply circle for each of the five palette colors. Writes go through the same highlights service as `useHighlights`, so the passage repaints immediately and the sheet closes.
- **Sign-in and permission prompts.** A signed-out user, or one who has not granted the `highlights` permission, is asked for exactly what is missing, and their color choice is applied afterwards — no reselecting the verse. Requires an `auth` config that requests the `highlights` permission; without one the swatches behave as they do for a signed-out user.
- **Copy and Share**, falling back to `expo-clipboard` and React Native's `Share`. Two new optional props on `BibleReader`, `onCopy` and `onShare`, take either over. Both receive the `BibleReaderShareData` already re-exported from this package.

**The sheet has no backdrop, and that is deliberate.** A backdrop intercepts the second verse tap, and extending a selection one verse at a time is the point. The consequence is that tapping outside does not dismiss it — swipe down, deselect the verses, or act on the sheet. Every themed bottom sheet in the SDK now draws an upward drop shadow so a backdrop-less sheet still separates from the content behind it.

`onVerseSelect` and `clearSelectionSignal` are unchanged and still public: the first fires alongside the sheet rather than instead of it, and the second closes the sheet along with the selection.

**Web keeps the React Web SDK's verse action popover.** Native verse actions are not available on web in this release. `NativeSheet` renders nothing there, so suppressing the popover would leave the reader with no verse action UI at all. The popover is what web gets until the native surface reaches it.

Nothing changes in the core package's public API. It versions alongside UI.

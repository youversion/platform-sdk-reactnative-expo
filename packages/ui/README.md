![License](https://img.shields.io/badge/license-Apache%202.0-blue)

# @youversion/platform-react-native-expo-ui

Drop-in YouVersion Bible components for React Native (Expo) apps. Built on the React Web SDK via [Expo DOM Components](https://docs.expo.dev/guides/dom-components/).

## When to use this package

Use `@youversion/platform-react-native-expo-ui` when you need:

- ✅ Pre-built Bible components for Expo: `BibleCard`, `BibleReader`, `BibleTextView`, `VerseOfTheDay`
- ✅ Highlights in `BibleReader`, with sign-in and permission prompts, offline retry, and copy/share handled natively
- ✅ Version/chapter picker and reader-settings bottom sheets, plus `YouVersionAuthButton`
- ✅ Light/dark theming across every component, from one `YouVersionProvider` at your app root
- ✅ Minimal setup: install, wrap, render

❌ Only need auth or storage APIs, with no UI? Use [@youversion/platform-react-native-expo-core](https://www.npmjs.com/package/@youversion/platform-react-native-expo-core) directly.

## Install

```bash
npx expo install @youversion/platform-react-native-expo-ui @youversion/platform-react-native-expo-core
```

Requires Expo SDK 56+, React 19, and a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go — the SDK relies on native modules). Peer dependencies are listed in [`package.json`](./package.json).

Installing or updating peer dependencies means rebuilding your dev client (`npx expo prebuild --clean` then `expo run:ios` / `expo run:android`) — a JS-only reload cannot link native code. `expo-clipboard`, used by the Bible reader's Copy action, is the most recent addition.

Get your App Key at [platform.youversion.com](https://platform.youversion.com/).

## Usage

Keep `GestureHandlerRootView` outside `YouVersionProvider`, then render components inside:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { YouVersionProvider, BibleCard } from '@youversion/platform-react-native-expo-ui'

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <YouVersionProvider appKey="YOUR_APP_KEY">
        <BibleCard reference="JHN.3.16" versionId={3034} />
      </YouVersionProvider>
    </GestureHandlerRootView>
  )
}
```

### Highlights

`BibleReader` paints and writes the signed-in user's highlights once auth is configured with the `highlights` permission — which travels in `requested_permissions[]`, not in `scopes`:

```tsx
<YouVersionProvider
  appKey="YOUR_APP_KEY"
  auth={{ redirectUri, scopes: ['profile', 'email'], permissions: ['highlights'] }}
>
  <BibleReader defaultVersionId={3034} onHighlightError={(error) => showPendingHint(error)} />
</YouVersionProvider>
```

The reader owns the whole flow: cached paint on the first frame, the sign-in sheet for signed-out taps, the just-in-time consent alert for a missing permission, a persisted retry queue for writes that can't reach the server, and a warning before signing out with unsaved work. With no `auth` config, a color tap is a silent no-op.

`onHighlightError` means **queued and retrying** — the highlight is still painted and survives an app kill, so present it as a pending or offline hint. Payload errors are logged instead.

#### Keeping highlights current

The reader re-fetches on a chapter change and when the app returns from the background, so a highlight made in the YouVersion Bible App or on another device appears without a restart. Navigation focus is the one trigger the SDK can't see — detecting it would force `@react-navigation/native` on every consumer — so it's exposed as an imperative handle for the host to call:

```tsx
import type { BibleReaderHandle } from '@youversion/platform-react-native-expo-ui'
import { useFocusEffect } from 'expo-router'
import { useCallback, useRef } from 'react'

const reader = useRef<BibleReaderHandle>(null)

useFocusEffect(
  useCallback(() => {
    void reader.current?.refreshHighlights()
  }, []),
)

return <BibleReader ref={reader} defaultVersionId={3034} />
```

`refreshHighlights()` de-dupes against a fetch already in flight, no-ops when signed out, and never blanks what's already painted — so it's safe to call on every focus.

Related props: `onVerseSelect` (fires on every selection change, `verses: []` on clear), and `onCopy` / `onShare`, which override the SDK's native clipboard and share-sheet fallbacks.

There is no `highlights` prop on `BibleReader`. The Web SDK's controlled highlights mode is an internal mechanism this package uses to talk to the reader, not a supported surface — to build your own highlight UI, use `useHighlights` from [`@youversion/platform-react-native-expo-core`](https://www.npmjs.com/package/@youversion/platform-react-native-expo-core).

## Documentation and API Reference

- [React Native (Expo) SDK Quick Start](https://developers.youversion.com/sdks/react-native)

## License

This SDK is licensed under [Apache 2.0](./LICENSE).

Licensing information for the Bible versions is available at the [YouVersion Platform](https://platform.youversion.com/) site.

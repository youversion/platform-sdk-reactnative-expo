# YouVersion Platform React Native Expo SDK

A React Native SDK for integrating [YouVersion Platform](https://platform.youversion.com/) features into Expo apps using [Expo DOM Components](https://docs.expo.dev/guides/dom-components/).

Built on top of the [React Web SDK](https://github.com/youversion/platform-sdk-react) (`@youversion/platform-react-ui`), wrapping web components as native DOM components while providing native affordances (sheets, navigation, storage) via React Native.

## Prerequisites

- Node.js >= 20.0.0
- pnpm 9+
- Expo SDK 55+
- Xcode (for iOS builds)
- Android Studio (for Android builds)

> **Note:** This SDK requires a [dev build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go) due to native module dependencies.

## Getting Started

```bash
pnpm install

# Build and run the example app (dev build)
cd apps/example
pnpm build:ios       # or pnpm build:android

# Start the dev server (after first build)
pnpm exec expo start --dev-client
```

## Setup

Wrap your app root with `YouVersionProvider`:

```tsx
import { YouVersionProvider } from '@youversion/platform-react-native-expo'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY

  if (!appKey) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <YouVersionProvider appKey={appKey}>
        {/* your app */}
      </YouVersionProvider>
    </GestureHandlerRootView>
  )
}
```

`GestureHandlerRootView` must wrap `YouVersionProvider`; the provider includes internal bottom-sheet support that depends on React Native Gesture Handler.

## API Reference

### Components
- `YouVersionProvider` — App-level provider for app key, theme, and native sheet support
- `BibleCard` — Bible card widget
- `VerseOfTheDay` — Verse of the day widget
- `BibleReader` — Bible reader with native sheet footnote display
- `BibleTextView` — Bible text passage viewer with native sheet footnote display

`BibleCard`, `VerseOfTheDay`, `BibleReader`, and `BibleTextView` read `appKey` from `YouVersionProvider`. Component-level `theme` props can still override the provider theme.

```tsx
function BibleScreen() {
  return (
    <>
      <BibleTextView reference="JHN.1.1-4" versionId={3034} showVerseNumbers />
      <BibleReader defaultVersionId={3034} />
      <BibleCard reference="JHN.3.16" versionId={3034} dom={{ matchContents: true }} />
      <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />
    </>
  )
}
```

`YouVersionProvider` accepts `theme="light" | "dark" | "system"`. Components with theme props can override the provider theme for that instance.

## Peer Dependencies

See [`packages/ui/package.json`](./packages/ui/package.json) `peerDependencies` for the canonical peer dependency list.

**Bundled runtime deps** (no install needed): `@rn-primitives/portal`, `zustand`

## Project Structure

```
packages/ui/src/
├── dom/           ← Expo DOM components ("use dom") wrapping the React Web SDK
├── native/        ← React Native provider/context, wrappers, and internal sheet support
└── lib/           ← Native adapters, hooks, constants
```

## Contributing

> [!NOTE]
> We are not yet accepting pull requests from external contributors, though we intend to do so in the future. In the meantime, we welcome you to use the SDK, report bugs via [GitHub Issues](https://github.com/youversion/platform-sdk-reactnative-expo/issues), and share feedback.

## License

This SDK is licensed under [Apache 2.0](./LICENSE).

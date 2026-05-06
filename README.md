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
pnpm start
```

## Setup

Wrap your app root with `NativeSheetProvider` to enable native bottom sheets:

```tsx
import { NativeSheetProvider } from '@youversion/platform-react-native-expo'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NativeSheetProvider>
        {/* your app */}
      </NativeSheetProvider>
    </GestureHandlerRootView>
  )
}
```

## API Reference

### DOM Components (rendered in WebView)
- `BibleReaderDOM` — Bible reader with footnote support
- `BibleTextViewDOM` — Bible text passage viewer
- `FootnoteContent` — Footnote display (pre-warmed WebView)
- `BibleCard` — Bible card widget
- `VerseOfTheDay` — Verse of the day widget

### Native Components (React Native)
- `BibleReader` — BibleReaderDOM + NativeSheet for footnote display
- `BibleTextView` — BibleTextViewDOM + NativeSheet for footnote display
- `NativeSheet` / `NativeSheetProvider` — Portal-based bottom sheet

## Peer Dependencies

**Peer deps** (install separately): `@gorhom/bottom-sheet`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-webview`. See [`packages/ui/package.json`](./packages/ui/package.json) `peerDependencies` for the full list.

**Bundled runtime deps** (no install needed): `@rn-primitives/portal`, `zustand`

## Project Structure

```
packages/ui/src/
├── dom/           ← Expo DOM components ("use dom") wrapping the React Web SDK
├── native/        ← React Native components (sheets, portal provider, wrappers)
└── lib/           ← Native adapters, hooks, constants
```

## Contributing

> [!NOTE]
> We are not yet accepting pull requests from external contributors, though we intend to do so in the future. In the meantime, we welcome you to use the SDK, report bugs via [GitHub Issues](https://github.com/youversion/platform-sdk-reactnative-expo/issues), and share feedback.

## License

This SDK is licensed under [Apache 2.0](./LICENSE).

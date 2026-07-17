![License](https://img.shields.io/badge/license-Apache%202.0-blue)

# @youversion/platform-react-native-expo-ui

Drop-in YouVersion Bible components for React Native (Expo) apps. Built on the React Web SDK via [Expo DOM Components](https://docs.expo.dev/guides/dom-components/).

## When to use this package

Use `@youversion/platform-react-native-expo-ui` when you need:

- ✅ Pre-built Bible components for Expo: `BibleCard`, `BibleReader`, `BibleTextView`, `VerseOfTheDay`
- ✅ Version/chapter picker and reader-settings bottom sheets, plus `YouVersionAuthButton`
- ✅ Light/dark theming across every component, from one `YouVersionProvider` at your app root
- ✅ Minimal setup: install, wrap, render

❌ Only need auth or storage APIs, with no UI? Use [@youversion/platform-react-native-expo-core](https://www.npmjs.com/package/@youversion/platform-react-native-expo-core) directly.

## Install

```bash
npx expo install @youversion/platform-react-native-expo-ui @youversion/platform-react-native-expo-core
```

Requires Expo SDK 56+, React 19, and a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go — the SDK relies on native modules). Peer dependencies are listed in [`package.json`](./package.json).

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

## Documentation and API Reference

- [React Native (Expo) SDK Quick Start](https://developers.youversion.com/sdks/react-native)

## License

This SDK is licensed under [Apache 2.0](./LICENSE).

Licensing information for the Bible versions is available at the [YouVersion Platform](https://platform.youversion.com/) site.

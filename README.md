<!-- TODO: Banner image (e.g. ./assets/github-rn-sdk-banner.png) (tracking: [YPE-2833](https://lifechurch.atlassian.net/browse/YPE-2833)). -->

![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue) [![License](https://img.shields.io/badge/license-Apache-blue.svg)](LICENSE)

# YouVersion Platform SDK for React Native (Expo)

A React Native SDK for integrating with the YouVersion Platform, to display Bible content in Expo apps on iOS and Android.

Built on top of the [React Web SDK](https://github.com/youversion/platform-sdk-react) (`@youversion/platform-react-ui`), wrapping web components as [Expo DOM Components](https://docs.expo.dev/guides/dom-components/) while providing native affordances (bottom sheets, navigation, storage) through React Native.

## For Different Use Cases

### React Native SDK

Building an Expo app for iOS or Android? This SDK provides React Native components including `BibleTextView`, `BibleCard`, `BibleReader`, and `VerseOfTheDay`, with native bottom-sheet presentation for mobile interactions.

### API Integration

Need direct access to YouVersion Platform APIs? See [our API documentation](https://developers.youversion.com/overview) for advanced integration patterns and REST endpoints.

### LLM Integration

Building AI applications with Bible content? Access YouVersion's LLM-optimized endpoints and structured data designed for language models. See [our LLM documentation](https://developers.youversion.com/for-llms) for details.

## Table of Contents

- [For Different Use Cases](#for-different-use-cases)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Expo](#expo)
- [Getting Started](#getting-started)
- [Usage](#usage)
  - [Displaying Scripture](#displaying-scripture)
  - [Bible Reader](#bible-reader)
  - [Verse of the Day](#verse-of-the-day)
  - [Sign In](#sign-in)
- [Sample App](#sample-app)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Features

- 📖 **Scripture Display** - Drop-in React Native components for Bible passages with `BibleTextView` and `BibleCard`
- 📚 **Bible Reader** - A complete Bible reading experience inside your app with `BibleReader`, including built-in chapter and version pickers
- 🌅 **Verse of the Day** - Built-in `VerseOfTheDay` component
- 🔐 **Sign in** - Optional PKCE OAuth via `YouVersionProvider` and `useYVAuth` (`@youversion/platform-react-native-expo-core`)
- 🎨 **Theming** - `light` / `dark` / `system` themes, with per-component overrides
- 📱 **Native presentation** - Footnotes, chapter, and version pickers open in native bottom sheets via `@gorhom/bottom-sheet`

## Requirements

- Expo SDK 55
- A YouVersion Platform API key ([Register here](https://platform.youversion.com/))

> **Note:** This SDK requires a [dev build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go) due to native module dependencies.

## Installation

### Expo

> [!NOTE]
> This SDK is not yet published to npm. The install commands below are placeholders for the upcoming release.

<!-- TODO: replace with real install once package is published -->

```bash
npx expo install @youversion/platform-react-native-expo-ui @youversion/platform-react-native-expo-core
```

The UI package depends on core at runtime; install both so TypeScript resolves `@youversion/platform-react-native-expo-core` when you use auth APIs.

Install the required peer dependencies (Expo will pick versions compatible with your SDK):

```bash
npx expo install @gorhom/bottom-sheet @expo/dom-webview expo-secure-store \
  react-dom \
  react-native-gesture-handler react-native-mmkv \
  react-native-nitro-modules react-native-reanimated \
  react-native-safe-area-context react-native-webview
```

Expo, React, and React Native are also peer dependencies, but they are expected to be provided by your Expo app.

See [`packages/ui/package.json`](./packages/ui/package.json) and [`packages/core/package.json`](./packages/core/package.json) `peerDependencies` for the canonical lists.

## Getting Started

1. **Get your app key**: register your app with [YouVersion Platform](https://platform.youversion.com/) to acquire one.
2. **Wrap your app root** with `YouVersionProvider`:

```tsx
import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY

  if (!appKey) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <YouVersionProvider appKey={appKey} theme="system">
        {/* your app */}
      </YouVersionProvider>
    </GestureHandlerRootView>
  )
}
```

`GestureHandlerRootView` must wrap `YouVersionProvider` — the provider includes internal bottom-sheet support that depends on React Native Gesture Handler.

`YouVersionProvider` accepts `theme="light" | "dark" | "system"` and defaults to `"system"`, which follows the device color scheme (falling back to `"light"` when the device scheme is unavailable). Components below can override the provider theme for that instance.

## Usage

All components below read `appKey` from `YouVersionProvider`. Component-level `theme` props can still override the provider theme.

### Displaying Scripture

Display a verse range or single verse with `BibleTextView`:

```tsx
import { BibleTextView } from '@youversion/platform-react-native-expo-ui'

function VerseScreen() {
  return (
    <BibleTextView
      reference="JHN.3.16"          // USFM reference: BOOK.CHAPTER.VERSE (or VERSE-VERSE for a range)
      versionId={3034}              // 3034 = NIV (find IDs at platform.youversion.com)
      showVerseNumbers
    />
  )
}
```

Display a Bible card with a verse and reader controls:

```tsx
import { BibleCard } from '@youversion/platform-react-native-expo-ui'

function CardScreen() {
  return (
    <BibleCard
      reference="JHN.3.16"
      versionId={3034}
      dom={{ matchContents: true }}
    />
  )
}
```

> **Note:** Scripture content is fetched from YouVersion servers; the underlying WebView caches responses for repeat reads.

### Bible Reader

`BibleReader` gives you a full Bible reading experience, ready to drop in as a tab or full screen:

```tsx
import { BibleReader } from '@youversion/platform-react-native-expo-ui'

function ReaderScreen() {
  return <BibleReader defaultVersionId={3034} />
}
```

`BibleReader` is stateful — it owns the current `versionId` and coordinates its built-in chapter and version picker sheets.

#### Custom picker flows (escape hatch)

To present your own picker UI instead of the built-in sheets, pass `onChapterPickerPress` or `onVersionPickerPress`. The built-in sheet is suppressed and you receive the current selection:

```tsx
<BibleReader
  defaultVersionId={3034}
  onVersionPickerPress={({ versionId, languageId }) => {
    // present your own version picker
  }}
/>
```

The standalone sheets are also exported (`BibleChapterPickerSheet`, `BibleVersionPickerSheet`, `BibleReaderSettingsSheet`) for advanced flows.

### Verse of the Day

```tsx
import { VerseOfTheDay } from '@youversion/platform-react-native-expo-ui'

function VotdScreen() {
  return <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />
}
```

### Sign In

Authentication is optional. Pass an `auth` config to `YouVersionProvider`, register the same `redirectUri` in the [YouVersion Platform](https://platform.youversion.com/) console, and handle the OAuth redirect in your app (for example with an Expo Router screen at `app/callback.tsx`).

```tsx
import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import * as Linking from 'expo-linking'
import { Button } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY
  const redirectUri = Linking.createURL('callback')

  if (!appKey) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <YouVersionProvider
        appKey={appKey}
        auth={{ redirectUri, scopes: ['profile', 'email'] }}
      >
        {/* your app */}
      </YouVersionProvider>
    </GestureHandlerRootView>
  )
}

function SignInButton() {
  const { isAuthenticated, isLoading, signIn, signOut } = useYVAuth()

  if (isLoading) return null
  if (isAuthenticated) {
    return <Button title="Sign out" onPress={() => signOut()} />
  }
  return <Button title="Sign in with YouVersion" onPress={() => signIn()} />
}
```

`useYVAuth` must be used under `YouVersionProvider` with the `auth` prop set. Tokens are stored in `expo-secure-store`; profile metadata is cached in MMKV. See [`apps/example`](./apps/example) for a working callback route and dev auth debug tab.

## Sample App

Explore the [`apps/example`](./apps/example) directory for a sample Expo Router app demonstrating:

- Bible reader integration
- Bible card and Scripture display
- Verse of the Day
- PKCE sign-in, OAuth callback handling, and an auth debug tab
- Provider and native dependency setup

To run it:

```bash
git clone https://github.com/youversion/platform-sdk-reactnative-expo.git
cd platform-sdk-reactnative-expo
pnpm install

# Build the dev client (first time)
cd apps/example
pnpm build:ios       # or: pnpm build:android

# Subsequent runs
pnpm exec expo start --dev-client
```

Set `EXPO_PUBLIC_YOUVERSION_APP_KEY` in your environment or an `.env` file before starting the example app.

See the [Contributing Guide](./CONTRIBUTING.md) for additional local development setup.

## Documentation

<!-- TODO: Link to RN SDK page on developers.youversion.com once published (tracking: [YPE-2832](https://lifechurch.atlassian.net/browse/YPE-2832)). -->

- [API Documentation](https://developers.youversion.com/overview) — REST API reference
- [LLM Integration Guide](https://developers.youversion.com/for-llms) — AI/ML integration docs
- [Sample Code](./apps/example) — Working examples and provider setup

## Contributing

> [!NOTE]
> We are not yet accepting pull requests from external contributors. In the meantime, we welcome you to use the SDK, report bugs via [GitHub Issues](https://github.com/youversion/platform-sdk-reactnative-expo/issues), and share feedback.

For internal development, see the [Contributing Guide](./CONTRIBUTING.md).

## Support

- **Issues**: [GitHub Issues](https://github.com/youversion/platform-sdk-reactnative-expo/issues)
- **Platform Support**: [YouVersion Platform](https://platform.youversion.com/support)

## License

This SDK is licensed under the Apache License 2.0. See [LICENSE](./LICENSE) for details.

---

Made with ❤️ by [YouVersion](https://www.youversion.com)

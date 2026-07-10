![YouVersion Platform React Native Expo SDK](./assets/github-rn-sdk-banner.png)

# YouVersion Platform SDK for React Native (Expo)

![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue) [![License](https://img.shields.io/badge/license-Apache-blue.svg)](LICENSE)

A React Native SDK for displaying Bible content in Expo apps on iOS and Android. It wraps the [React Web SDK](https://github.com/youversion/platform-sdk-react) (`@youversion/platform-react-ui`) as [Expo DOM Components](https://docs.expo.dev/guides/dom-components/), adding native affordances (bottom sheets, navigation, storage) through React Native.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Localization](#localization)
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

- **Scripture display**: React Native components for Bible passages with `BibleTextView` and `BibleCard`
- **Bible Reader**: a complete reading experience with `BibleReader`, including built-in chapter and version pickers
- **Verse of the Day**: built-in `VerseOfTheDay` component
- **Sign in**: optional PKCE OAuth via `YouVersionProvider` and `useYVAuth` (`@youversion/platform-react-native-expo-core`)
- **Theming**: `light` / `dark` / `system` themes, with per-component overrides
- **Native presentation**: footnotes, chapter, and version pickers open in native bottom sheets via `@gorhom/bottom-sheet`

## Requirements

- Expo SDK 56
- A YouVersion Platform API key ([register here](https://platform.youversion.com/))

> **Note:** This SDK requires a [dev build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go) due to native module dependencies.

## Installation

> [!NOTE]
> This SDK is not yet published to npm. The install commands below are placeholders for the upcoming release.

<!-- TODO: replace with real install once package is published -->

```bash
npx expo install @youversion/platform-react-native-expo-ui @youversion/platform-react-native-expo-core
```

The UI package depends on core at runtime; install both so TypeScript resolves `@youversion/platform-react-native-expo-core` when you use auth APIs.

Install the required peer dependencies (Expo will pick versions compatible with your SDK):

```bash
npx expo install @gorhom/bottom-sheet @expo/dom-webview \
  expo-application expo-crypto expo-secure-store expo-web-browser \
  react-dom \
  react-native-gesture-handler react-native-mmkv \
  react-native-nitro-modules react-native-reanimated \
  react-native-safe-area-context react-native-svg
```

Expo, React, and React Native are also peer dependencies, but they are expected to be provided by your Expo app.

### Optional peer dependencies

Install these only if your app needs them:

```bash
# Reanimated 4 splits worklets into a standalone package. Install it if your
# app uses react-native-reanimated v4 (Expo SDK 56 ships v4 by default).
npx expo install react-native-worklets

# DOM components render in @expo/dom-webview by default. Install this only if
# you opt a component out via dom={{ useExpoDOMWebView: false }}.
npx expo install react-native-webview
```

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

### Localization

Native SDK strings (auth button labels, sheet loader accessibility) follow the **device locale** by default via bundled `expo-localization`. No setup is required:

```tsx
<YouVersionProvider appKey={appKey}>{/* your app */}</YouVersionProvider>
```

Pass an explicit **`locale`** when your app manages language (for example, an in-app language picker) so SDK strings stay in sync with the rest of your UI:

```tsx
<YouVersionProvider appKey={appKey} locale={appLocale}>
  {/* your app */}
</YouVersionProvider>
```

`locale` controls **native** SDK UI copy only (auth button, sheet chrome, loader accessibility). Bible content and in-WebView UI (reader, pickers, footnotes) remain in the Web SDK default language — see [ADR 0007](./docs/adr/0007-app-locale-vs-bible-language-id.md) and [ADR 0009](./docs/adr/0009-deferred-dom-localization.md). Bible translation selection (`versionId`, version picker) is separate from app locale.

`i18next`, `react-i18next`, and `expo-localization` are bundled with the UI package for SDK localization — consumers do not install them unless they want `expo-localization` for their own app screens.

## Usage

All components below read `appKey` from `YouVersionProvider`. Component-level `theme` props can still override the provider theme.

### Displaying Scripture

Display a verse range or single verse with `BibleTextView`:

```tsx
import { BibleTextView } from '@youversion/platform-react-native-expo-ui'

function VerseScreen() {
  return (
    <BibleTextView
      reference="JHN.3.16" // USFM reference: BOOK.CHAPTER.VERSE (or VERSE-VERSE for a range)
      versionId={3034} // 3034 = NIV (find IDs at platform.youversion.com)
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
    <BibleCard reference="JHN.3.16" defaultVersionId={3034} dom={{ matchContents: true }} />
  )
}
```

`BibleCard` is stateful — it owns the current Bible translation and can open a built-in version picker. Use **`defaultVersionId`** for the initial translation in uncontrolled mode (the usual case; the card persists the user's picker choice). Use **`versionId`** together with **`onVersionChange`** when you need a controlled translation. Passing `versionId` alone still seeds uncontrolled state for backwards compatibility, but prefer `defaultVersionId` for new code.

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

#### Custom picker flows

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

Authentication is optional. Pass an `auth` config to `YouVersionProvider`, register the same `redirectUri` in the [YouVersion Platform](https://platform.youversion.com/) console, and handle the OAuth redirect in your app (for example, with an Expo Router screen at `app/callback.tsx`).

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
      <YouVersionProvider appKey={appKey} auth={{ redirectUri, scopes: ['profile', 'email'] }}>
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

- [React Native (Expo) SDK Guide](https://developers.youversion.com/sdks/react-native-expo/quick-start): quick start and integration guide for this SDK
- [API Documentation](https://developers.youversion.com/overview): REST API reference for advanced integration patterns and endpoints
- [LLM Integration Guide](https://developers.youversion.com/for-llms): LLM-optimized Bible endpoints and structured data
- [Sample Code](./apps/example): working example app and provider setup

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

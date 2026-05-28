<!-- TODO: banner image (e.g. ./assets/github-rn-sdk-banner.png) -->

[![License](https://img.shields.io/badge/license-Apache-blue.svg)](LICENSE)

# YouVersion Platform SDK for React Native (Expo)

A React Native SDK for integrating with the YouVersion Platform, to display Bible content in Expo apps on iOS and Android.

Built on top of the [React Web SDK](https://github.com/youversion/platform-sdk-react) (`@youversion/platform-react-ui`), wrapping web components as [Expo DOM Components](https://docs.expo.dev/guides/dom-components/) while providing native affordances (bottom sheets, navigation, storage) through React Native.

## Table of Contents

- [YouVersion Platform SDK for React Native (Expo)](#youversion-platform-sdk-for-react-native-expo)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Getting Started](#getting-started)
  - [Usage](#usage)
    - [Displaying Scripture](#displaying-scripture)
    - [Bible Reader](#bible-reader)
      - [Custom picker flows (escape hatch)](#custom-picker-flows-escape-hatch)
    - [Verse of the Day](#verse-of-the-day)
    - [Sign In](#sign-in)
  - [Sample App](#sample-app)
  - [Documentation](#documentation)
  - [Contributing](#contributing)
  - [Support](#support)
  - [License](#license)

## Features

- 📖 **Scripture Display** — drop-in React Native components for Bible passages with `BibleTextView` and `BibleCard`
- 📚 **Bible Reader** — a complete Bible reading experience inside your app with `BibleReader`, including built-in chapter and version pickers
- 🌅 **Verse of the Day** — built-in `VerseOfTheDay` component
- 🎨 **Theming** — `light` / `dark` / `system` themes, with per-component overrides
- 📱 **Native presentation** — footnotes, chapter, and version pickers open in native bottom sheets via `@gorhom/bottom-sheet`

## Requirements

- Expo SDK 55
- A YouVersion Platform API key ([Register here](https://platform.youversion.com/))

> **Note:** This SDK requires a [dev build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go) due to native module dependencies.

## Installation

> [!NOTE]
> This SDK is not yet published to npm. The install commands below are placeholders for the upcoming release.

<!-- TODO: replace with real install once package is published -->

```bash
npx expo install @youversion/platform-react-native-expo
```

Install the peer dependencies (Expo will pick versions compatible with your SDK):

```bash
npx expo install @gorhom/bottom-sheet expo-secure-store \
  react-dom \
  react-native-gesture-handler react-native-mmkv \
  react-native-nitro-modules react-native-reanimated \
  react-native-safe-area-context react-native-webview
```

See [`packages/ui/package.json`](./packages/ui/package.json) `peerDependencies` for the canonical list.

## Getting Started

1. **Get your app key**: register your app with [YouVersion Platform](https://platform.youversion.com/) to acquire one.
2. **Wrap your app root** with `YouVersionProvider`:

```tsx
import { YouVersionProvider } from '@youversion/platform-react-native-expo'
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

`YouVersionProvider` accepts `theme="light" | "dark" | "system"`. Components below can override the provider theme for that instance.

## Usage

All components below read `appKey` from `YouVersionProvider`. Component-level `theme` props can still override the provider theme.

### Displaying Scripture

Display a verse range or single verse with `BibleTextView`:

```tsx
import { BibleTextView } from '@youversion/platform-react-native-expo'

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
import { BibleCard } from '@youversion/platform-react-native-expo'

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
import { BibleReader } from '@youversion/platform-react-native-expo'

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
import { VerseOfTheDay } from '@youversion/platform-react-native-expo'

function VotdScreen() {
  return <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />
}
```

### Sign In

> [!NOTE]
> Sign-in / authentication support is **coming soon** to this SDK. For current availability and implementation guidance, contact [YouVersion Platform Support](https://platform.youversion.com/support).

## Sample App

The [`apps/example`](./apps/example) directory contains a sample Expo Router app demonstrating the SDK.

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

## Documentation

<!-- TODO: link to RN SDK page on developers.youversion.com once published -->

- [API Documentation](https://developers.youversion.com/overview) — REST API reference
- [LLM Integration Guide](https://developers.youversion.com/for-llms) — AI/ML integration docs

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

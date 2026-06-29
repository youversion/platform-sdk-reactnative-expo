# Changelog

All notable changes to the YouVersion Platform React Native (Expo) SDK are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The monorepo publishes two packages that are versioned together:

- `@youversion/platform-react-native-expo-ui` — Bible components, theming, and the app provider
- `@youversion/platform-react-native-expo-core` — installation id, optional auth, and storage

## [0.0.1] - Unreleased

Initial release. Drop YouVersion Bible content into an Expo app on iOS and Android, with native bottom sheets, theming, and optional sign-in. Built on the [React Web SDK](https://github.com/youversion/platform-sdk-react) wrapped as [Expo DOM Components](https://docs.expo.dev/guides/dom-components/), with native affordances layered on top.

### Added

**Scripture display**

- `BibleTextView` — render a verse or verse range from a USFM reference
- `BibleCard` — a verse with built-in reader controls
- `VerseOfTheDay` — the daily verse, ready to drop in

**Bible reader**

- `BibleReader` — a full reading experience with built-in chapter and version pickers; bring your own picker UI via `onChapterPickerPress` / `onVersionPickerPress`
- Standalone sheets for advanced flows: `BibleChapterPickerSheet`, `BibleVersionPickerSheet`, `BibleReaderSettingsSheet`

**Provider & theming**

- `YouVersionProvider` — single root provider supplying your `appKey`, resolved theme, and native sheet support
- `light` / `dark` / `system` themes, with per-component overrides

**Authentication (optional)**

- PKCE OAuth via the `auth` prop on `YouVersionProvider`, the `useYVAuth` hook, and `YouVersionAuthButton`
- Tokens stored in `expo-secure-store`; profile metadata cached in MMKV (`@youversion/platform-react-native-expo-core`)

**Native presentation**

- Footnotes, chapter, and version pickers open in native bottom sheets via `@gorhom/bottom-sheet`
- WebView pre-warming so sheets open without a cold-start flash

### Requirements

- Expo SDK 56, React 19, React Native 0.85+
- A YouVersion Platform app key ([register here](https://platform.youversion.com/))
- A [dev build](https://docs.expo.dev/develop/development-builds/introduction/) — Expo Go is not supported

[0.0.1]: https://github.com/youversion/platform-sdk-reactnative-expo

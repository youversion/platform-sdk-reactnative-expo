# @youversion/platform-react-native-expo-ui

## 1.0.0

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

- `YouVersionAuthButton` and the `auth` prop on `YouVersionProvider` for PKCE OAuth (auth primitives and storage live in `@youversion/platform-react-native-expo-core`)

**Native presentation**

- Footnotes, chapter, and version pickers open in native bottom sheets via `@gorhom/bottom-sheet`
- WebView pre-warming so sheets open without a cold-start flash

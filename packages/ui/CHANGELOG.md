# @youversion/platform-react-native-expo-ui

## 0.10.0

### Minor Changes

- 96c7075: `BibleCard` now defaults `showVersionPicker` to `false`, matching the React Web SDK. The version picker trigger no longer renders and the built-in `BibleVersionPickerSheet` no longer mounts unless consumers pass `showVersionPicker` explicitly.
- 5373bd7: Export `DEFAULT_BIBLE_VERSION_ID` (3034, Berean Standard Bible) from the UI entry so consumers can reference the SDK's default Bible version instead of hardcoding the numeric ID. The constant now backs the internal `defaultVersionId` fallbacks for `BibleCard`, `BibleReader`, and the picker sheets.
- cc6115c: Re-export component prop types from the UI entry so consumers can import them directly instead of re-deriving via `React.ComponentProps`. Adds `BibleCardProps`, `BibleReaderProps`, `BibleReaderSettingsSheetProps`, `BibleTextViewProps`, `VerseOfTheDayProps`, and `YouVersionAuthButtonProps`.

### Patch Changes

- fab2690: Fix jarring layout jump when the Bible Version and Chapter picker sheets open on Android. The pre-warmed picker WebView sits in an offscreen inert sheet host where Android reports `visualViewport.height` as 0; the keyboard-viewport listener wrote that as `--yv-visible-height: 0px`, collapsing the picker shell (search bar at the top of an empty sheet) until a late viewport resize snapped everything into place mid-animation. Viewport heights below a plausibility floor are now treated as "hidden WebView" and fall back to the stylesheet default (100vh), so the pre-warmed layout is already correct when the sheet opens.
- d2a45e3: Pin runtime dependencies to exact versions (`@youversion/platform-react-ui`, `expo-localization`, `i18next`, `react-i18next`, `zustand`) as supply-chain protection, so consumer installs can never silently resolve a newer, potentially compromised release. Peer dependency ranges are unchanged.
- 6ba0c15: Fix the top issues flagged by React Doctor. Replace relative barrel imports (`../storage`, `../lib`, `../hooks`, `../i18n`) with direct module paths to trim the app bundle and speed startup. Fix a stale-closure risk in the auth bootstrap effect by holding the latest `setAuthState`/`refreshToken`/`clearAuthState` in a ref instead of silencing the exhaustive-deps warning, preserving mount-only behavior. Reset version-picker state during render (previous-prop comparison) instead of in an effect, removing a brief stale-UI frame on sheet reopen in both the DOM picker and the native picker sheet. Drop a dead duplicate `READER_SETTINGS_PERSIST_KEY` export from core storage.
- e073666: Refactor `useEffect` anti-patterns per React's "You Might Not Need an Effect" guidance. `BibleCard` and `BibleReader` now persist uncontrolled version/location to their MMKV-backed stores from the `useControllableState` `onChange` handler instead of a separate state-mirroring effect. `onChange` fires only when the value actually changes, so defaults are no longer written to storage on mount/hydration and there is a single source of persistence rather than a duplicated effect. `NativeSheet` resets its Android loader during render via previous-`openKey` comparison instead of in the imperative snap effect, eliminating a one-frame flash of the previous sheet content marked ready on repeated opens. No API changes; the only behavioral nuance is that storage stays empty until the user changes something (identical fallback UX).
- 4a53112: Split dev and partner traffic in the `x-yvp-sdk` telemetry header. Every published build previously reported `ReactNativeSDK=Dev`, because the documented "release workflow rewrites the value" step never existed — so partner and internal traffic were indistinguishable. Published builds now report `ReactNativeSDK={version}` and source builds report `ReactNativeSDK={version}-dev`, matching the Web SDK's format so one telemetry rule (`endsWith('-dev')`) covers both SDKs. A `prepublishOnly` stamp (`scripts/stamp-sdk-version.cjs`) flips the build-channel flag in the compiled build and aborts the publish if it cannot confirm the channel. See ADR 0012.
- f26add5: Match the version/chapter picker sheet header to the WebView surface (white in light mode, dark in dark mode) and keep the muted strip behind the search bar. Also corrects the dark sheet surface token to match the Web SDK background.
- 9f7e834: Cap all Native Sheets (version picker, chapter picker, reader settings, footnotes) at a maximum width of 640, horizontally centered, on wide screens like iPad. Below that breakpoint sheets remain full-width. The cap is applied once in `NativeSheet` via a computed horizontal margin on `@gorhom/bottom-sheet`'s `style` prop, so the whole sheet surface (handle, header, content, footer) is capped while the backdrop still covers the full screen.
- Updated dependencies [9a5587d]
- Updated dependencies [6ba0c15]
  - @youversion/platform-react-native-expo-core@0.10.0

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

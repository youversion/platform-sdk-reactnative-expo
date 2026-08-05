![YouVersion Platform React Native Expo SDK](./assets/github-rn-sdk-banner.png)

# YouVersion Platform SDK for React Native (Expo)

![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue) [![License](https://img.shields.io/badge/license-Apache-blue.svg)](LICENSE) ![Core coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/youversion/platform-sdk-reactnative-expo/badges/core.json) ![UI coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/youversion/platform-sdk-reactnative-expo/badges/ui.json)

A React Native SDK for displaying Bible content in Expo apps on iOS and Android. It wraps the [React Web SDK](https://github.com/youversion/platform-sdk-react) (`@youversion/platform-react-ui`) as [Expo DOM Components](https://docs.expo.dev/guides/dom-components/), adding native affordances (bottom sheets, navigation, storage) through React Native.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
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

- **Scripture display**: React Native components for Bible passages with `BibleTextView` and `BibleCard`
- **Bible Reader**: a complete reading experience with `BibleReader`, including built-in chapter and version pickers
- **Verse of the Day**: built-in `VerseOfTheDay` component
- **Sign in**: optional PKCE OAuth via `YouVersionProvider` and `useYVAuth` (`@youversion/platform-react-native-expo-core`)
- **Highlights**: `useHighlights` for optimistic highlight writes backed by an instant local cache (`@youversion/platform-react-native-expo-core`)
- **Theming**: `light` / `dark` / `system` themes, with per-component overrides
- **Native presentation**: footnotes, chapter, and version pickers open in native bottom sheets via `@gorhom/bottom-sheet`

## Requirements

- Expo SDK 56
- A YouVersion Platform API key ([register here](https://platform.youversion.com/))

> **Note:** This SDK requires a [dev build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go) due to native module dependencies.

## Installation

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
  react-native-safe-area-context react-native-svg \
  react-native-worklets
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

Native SDK strings follow the device locale by default; see the [localization guide](https://developers.youversion.com/sdks/react-native-expo/guides/localization) for details and the `locale` override.

## Usage

### Displaying Scripture

Display a verse range or single verse with `BibleTextView`:

```tsx
import { BibleTextView } from '@youversion/platform-react-native-expo-ui'

function VerseScreen() {
  return (
    <BibleTextView
      reference="JHN.3.16" // USFM reference: BOOK.CHAPTER.VERSE (or VERSE-VERSE for a range)
      versionId={3034} // 3034 = Berean Standard Bible (BSB); find other IDs at platform.youversion.com
    />
  )
}
```

`showVerseNumbers` (default `true`) controls whether verse numbers render inline.

Display a Bible card with a verse and reader controls:

```tsx
import { BibleCard } from '@youversion/platform-react-native-expo-ui'

// 3034 = Berean Standard Bible (BSB); find other IDs at platform.youversion.com
function CardScreen() {
  return <BibleCard reference="JHN.3.16" defaultVersionId={3034} />
}
```

`defaultVersionId` is uncontrolled — the user's version choice is persisted on device. For controlled usage, pass `versionId` with `onVersionChange` instead. The version picker button is hidden by default (matching the React Web SDK); pass `showVersionPicker` to enable it, and note that `onVersionPickerPress` only fires when `showVersionPicker` is set. Embeds size themselves to their content by default (`matchContents`); pass `dom={{ matchContents: false }}` to opt out and size with flex styles. See the [quick start](https://developers.youversion.com/sdks/react-native-expo/quick-start) for more.

> **Note:** Scripture content is fetched from YouVersion servers; the underlying WebView caches responses for repeat reads.

### Bible Reader

`BibleReader` gives you a full Bible reading experience, ready to drop in as a tab or full screen:

```tsx
import { BibleReader } from '@youversion/platform-react-native-expo-ui'

// 3034 = Berean Standard Bible (BSB); find other IDs at platform.youversion.com
function ReaderScreen() {
  return <BibleReader defaultVersionId={3034} />
}
```

`BibleReader` is stateful — it owns the current `versionId` and coordinates its built-in chapter and version picker sheets. It also paints the signed-in user's highlights on its own, provided your `auth` config requests the `highlights` permission — there is no prop to pass.

#### Verse selection

`onVerseSelect` reports every selection change, so you can react to one however you like — analytics, your own action UI, a custom share flow. `clearSelectionSignal` dismisses the current selection from native: increment it, and note its value at mount is the baseline, so mounting never clears.

```tsx
const [clearSelectionSignal, setClearSelectionSignal] = useState(0)

<BibleReader
  defaultVersionId={3034}
  onVerseSelect={async (selection) => {
    // selection.reference ("John 3:16"), .verses, .passageIds, .shareData
  }}
  clearSelectionSignal={clearSelectionSignal}
/>
```

Clears arrive too, as a selection with `verses: []`. Type a handler with `BibleReaderVerseSelection` / `BibleReaderShareData`, both re-exported from this package.

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

// 3034 = Berean Standard Bible (BSB); find other IDs at platform.youversion.com
function VotdScreen() {
  return <VerseOfTheDay versionId={3034} />
}
```

### Sign In

Authentication is optional. Pass an `auth` config to `YouVersionProvider` to enable it. After the user signs in, the browser redirects back to your app at the `redirectUri` you configure below, so your app needs a route at that path to receive the redirect and finish sign-in. With Expo Router, that means a screen whose path matches the redirect (e.g. `app/callback.tsx`); the example app's implementation is a copyable reference: [`apps/example/app/callback.tsx`](./apps/example/app/callback.tsx).

The `redirectUri` is where the browser sends the user back after sign-in. Use `youversionauth://callback`, the callback URL the [Swift](https://github.com/youversion/platform-sdk-swift) and [Kotlin](https://github.com/youversion/platform-sdk-kotlin) SDKs use for the same purpose, and register that exact URI as the Callback URI for your app key in the [YouVersion Platform](https://platform.youversion.com/) console.

Two things have to line up, and they are the usual source of trouble:

1. **`redirectUri` must equal the Callback URI registered for your app key.** An app key has exactly one. If they disagree, sign-in fails with `invalid_request: redirect_uri does not match registered callback URL`.
2. **Android must be able to route it.** Add the scheme to `app.json` and rebuild the dev client (`npx expo prebuild --clean` — this is a native change):

   ```json
   { "expo": { "scheme": "youversionauth" } }
   ```

   iOS needs nothing extra. Because this scheme is shared by every app integrating the SDK, Android may show an app chooser if more than one is installed — the same tradeoff the Kotlin SDK's sample app makes.

```tsx
import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY
  const redirectUri = 'youversionauth://callback'

  if (!appKey) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <YouVersionProvider
        appKey={appKey}
        auth={{ redirectUri, scopes: ['profile', 'email'], permissions: ['highlights'] }}
      >
        {/* your app */}
      </YouVersionProvider>
    </GestureHandlerRootView>
  )
}
```

`permissions` lists YouVersion Platform permissions (`'bibles'`, `'highlights'`, `'votd'`, `'demographics'`, `'bible_activity'`) to ask for on the consent screen — these are not OIDC scopes, so keep them out of `scopes`.

Requesting a permission is not the same as being granted it: the user can decline and sign-in still succeeds. Read back what they actually granted from `useYVAuth()` — `hasPermission('highlights')` for one check, or `grantedPermissions` for the whole list (`null` when nothing was requested or nothing is known yet, `[]` when the user declined). The grant is cached per user and survives a cold start.

#### Asking for a permission later

A user who signed in before your app needed a permission — or who declined at the time — does not have to sign out to grant it. `requestPermissions` opens YouVersion's consent page and merges the result into the cached grant:

```tsx
const { hasPermission, requestPermissions } = useYVAuth()

async function ensureHighlights() {
  if (hasPermission('highlights')) return true

  const outcome = await requestPermissions(['highlights'])
  if (outcome.status === 'granted') return outcome.grantedPermissions.includes('highlights')
  if (outcome.status === 'failure' && outcome.reason === 'not-permitted') {
    // This app key is not enabled for the permission — a console setting, not a user choice.
  }
  return false
}
```

It resolves rather than throwing: `{ status: 'granted', grantedPermissions }`, `{ status: 'cancel' }`, or `{ status: 'failure', reason, message }` where `reason` is `'not-signed-in' | 'not-permitted' | 'user-changed' | 'in-progress' | 'transient'`. A granted permission makes `hasPermission` true on the next render.

Only one request runs at a time. Calling it again for the **same** permissions while a consent page is open returns the in-flight request rather than opening a second one, so a double-tap on one button needs no guarding from you.

A second call for **different** permissions cannot share that answer — the open consent page never mentioned them. It resolves to `{ status: 'failure', reason: 'in-progress' }`. Wait for the running request to settle before asking again; retrying straight away just hits the same branch.

> [!IMPORTANT]
> **This flow returns to your `redirectUri`** — the same callback URL sign-in uses. An app key has exactly one registered callback URL, and both browser round-trips come back through it. Nothing extra to register for data exchange beyond what sign-in already needs.
>
> If your `redirectUri` disagrees with the callback URL registered for your app key, the consent page opens, the user consents, and the return never reaches the SDK — reported as `{ status: 'cancel' }`, indistinguishable from a decline. Verify the two match before assuming users are declining.

For sign-in UI, drop in `YouVersionAuthButton` — it renders the branded Sign in with YouVersion button and handles sign-in/sign-out for you:

```tsx
import { YouVersionAuthButton } from '@youversion/platform-react-native-expo-ui'

function ProfileScreen() {
  return <YouVersionAuthButton />
}
```

It accepts `mode` (`'auto' | 'signIn' | 'signOut'`, default `'auto'` toggles based on auth state), `background` (`'light' | 'dark'`), `outline`, `radius` (`'rounded' | 'rectangular'`), `size` (`'default' | 'short' | 'icon'`), and `text` (string, replaces the default localized label).

To build custom UI instead, use the `useYVAuth` hook:

```tsx
import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import { Button } from 'react-native'

function SignInButton() {
  const { isAuthenticated, isLoading, signIn, signOut } = useYVAuth()

  if (isLoading) return null
  if (isAuthenticated) {
    return <Button title="Sign out" onPress={() => signOut()} />
  }
  return <Button title="Sign in with YouVersion" onPress={() => signIn()} />
}
```

Calling `useYVAuth()` requires that the surrounding `YouVersionProvider` received an `auth` config — without it the hook throws. Tokens are stored in `expo-secure-store`; profile metadata is cached in MMKV. See [`apps/example`](./apps/example) for a working callback route and Profile tab.

## Sample App

Explore the [`apps/example`](./apps/example) directory for a sample Expo Router app demonstrating:

- Bible reader integration
- Bible card and Scripture display
- Verse of the Day
- PKCE sign-in, OAuth callback handling, and the Profile tab
- Provider and native dependency setup

Set `EXPO_PUBLIC_YOUVERSION_APP_KEY` in your environment or an `.env` file before starting the example app.

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

See the [Contributing Guide](./CONTRIBUTING.md) for additional local development setup.

## Documentation

- [React Native (Expo) SDK Guide](https://developers.youversion.com/sdks/react-native-expo/quick-start): quick start and integration guide for this SDK
- [API Documentation](https://developers.youversion.com/overview): REST API reference for advanced integration patterns and endpoints
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

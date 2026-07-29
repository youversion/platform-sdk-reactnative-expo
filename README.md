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
  - [Highlights](#highlights)
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
- **Highlights**: `BibleReader` paints and writes the signed-in user's highlights, with sign-in and permission prompts, offline retry, and copy/share built in — or drive your own UI with `useHighlights` (`@youversion/platform-react-native-expo-core`)
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
  expo-application expo-clipboard expo-crypto expo-secure-store expo-web-browser \
  react-dom \
  react-native-gesture-handler react-native-mmkv \
  react-native-nitro-modules react-native-reanimated \
  react-native-safe-area-context react-native-svg \
  react-native-worklets
```

> **Rebuild after installing.** These are native modules, so a JS-only reload cannot link them. Run `npx expo prebuild --clean` and rebuild your dev client (`pnpm build:ios` / `pnpm build:android`) — otherwise the app redboxes at runtime with `Cannot find native module 'X'`.

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

#### Reacting to the reader

Four optional props report what the reader is doing. None of them changes its behavior — the reader keeps owning its own selection and highlight state.

```tsx
<BibleReader
  defaultVersionId={3034}
  onVerseSelect={(selection) => {
    // { versionId, book, chapter, verses, passageIds }; verses is [] on clear
  }}
  onCopy={async (data) => {
    /* your clipboard handling — suppresses the SDK's */
  }}
  onShare={async (data) => {
    /* your share sheet — suppresses the SDK's */
  }}
  onHighlightError={(error) => {
    // A highlight write hasn't reached the server yet — see Highlights below
  }}
/>
```

Copy and Share work out of the box: without a handler the SDK writes the verse text to the system clipboard (`expo-clipboard`) and opens the native share sheet. Pass your own and the SDK's fallback doesn't run.

### Highlights

`BibleReader` renders the signed-in user's highlights and writes new ones — including highlights created in the YouVersion Bible App or on youversion.com. There is nothing to wire up beyond auth:

```tsx
<YouVersionProvider
  appKey={appKey}
  auth={{ redirectUri, scopes: ['profile', 'email'], permissions: ['highlights'] }}
>
  <BibleReader defaultVersionId={3034} />
</YouVersionProvider>
```

**`highlights` is a permission, not a scope.** It rides in `requested_permissions[]`, and the auth server silently drops unknown values from `scope` — so putting it in `scopes` grants nothing and the reader paints nothing. Changing this requires a fresh sign-in; an existing token does not gain the grant.

What the SDK handles for you:

- **Painting on the first frame.** Highlights are cached on device per chapter and read synchronously, so a revisited chapter paints with no spinner and no flash — and still paints offline.
- **Consent, just in time.** A signed-out user who taps a color gets the "Sign in with YouVersion" sheet; a signed-in user without the `highlights` permission gets a native alert leading to YouVersion's consent page. Either way the tap is held and applied on success, so the verse never has to be re-selected. Every cancellation exit discards it.
- **Offline writes.** A write that can't reach the server stays painted, is persisted, and retries with exponential backoff — surviving an app kill. `onHighlightError` fires for exactly this case, so render it as a pending or offline hint rather than a failure. Payload errors are logged instead; the user can't act on them.
- **Sign-out with unsaved work.** `YouVersionAuthButton` and the reader's own toolbar warn before signing out while highlight writes are still queued. Confirming discards them.
- **Staying current.** Highlights are re-fetched when the chapter changes and when the app returns from the background, so one made in the YouVersion Bible App or on another device shows up without a restart.

With no `auth` config on the provider, a color tap is a silent no-op.

#### Refreshing on navigation focus

The one moment the SDK can't see is your navigation. Detecting screen focus would mean taking `@react-navigation/native` as a peer dependency and forcing a navigation library on every app, so `BibleReader` exposes an imperative handle and you call it from the focus event you already own:

```tsx
import type { BibleReaderHandle } from '@youversion/platform-react-native-expo-ui'
import { useFocusEffect } from 'expo-router'
import { useCallback, useRef } from 'react'

const reader = useRef<BibleReaderHandle>(null)

useFocusEffect(
  useCallback(() => {
    void reader.current?.refreshHighlights()
  }, []),
)

return <BibleReader ref={reader} defaultVersionId={3034} />
```

Call it as often as you like: it de-dupes against a fetch already in flight, no-ops when signed out, and never blanks what's already painted — there's no loading state to handle.

The highlights the reader paints are SDK-owned — there is no `highlights` prop to pass in. To build your own highlight UI, use [`useHighlights`](./packages/core/README.md#highlights) from `@youversion/platform-react-native-expo-core`, which is the supported escape hatch.

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

The `redirectUri` is where the browser sends the user back after sign-in. `Linking.createURL('callback')` (from `expo-linking` — install it with `npx expo install expo-linking`) builds it from your app's URL scheme: in a dev build it produces `<your-scheme>://callback`, where `<your-scheme>` is the `scheme` in your `app.json`. The example app's scheme is `yvp-rn-example`, so its redirect URI is `yvp-rn-example://callback`. Register that exact URI as a Callback URI for your app key in the [YouVersion Platform](https://platform.youversion.com/) console.

Choose a scheme unique to your app: on Android, multiple apps registering the same scheme triggers the system disambiguation dialog (an app chooser), and on iOS there is no defined process for which app gets the scheme — the OS silently picks one.

```tsx
import { YouVersionProvider } from '@youversion/platform-react-native-expo-ui'
import * as Linking from 'expo-linking'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY
  const redirectUri = Linking.createURL('callback')

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

Requesting is not the same as being granted: the user can deny one and sign-in still succeeds. `useYVAuth()` reports what this device believes was granted, and can ask again at any time:

```tsx
const { grantedPermissions, hasPermission, requestPermission } = useYVAuth()

if (!hasPermission('highlights')) {
  const result = await requestPermission('highlights')
  // { kind: 'granted', permissions } | { kind: 'cancel' } | { kind: 'failure', message }
  // `granted` means the consent flow finished, not that your permission was in it.
}
```

`grantedPermissions` is `null` when unknown (signed out, or nothing recorded), which is distinct from `[]`. It is an optimistic mirror — seeded from what was requested at sign-in and corrected by the server, so a 401/403 on a write is still the ultimate check. `BibleReader` does all of this for you for highlights; reach for `requestPermission` when you own the UI.

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
- Highlights end to end: painting, writing, the sign-in and permission prompts, and an `onHighlightError` pending hint
- Bible card and Scripture display
- Verse of the Day
- PKCE sign-in, OAuth callback handling, and the Profile tab (granted permissions and `requestPermission`)
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

![License](https://img.shields.io/badge/license-Apache%202.0-blue)

# @youversion/platform-react-native-expo-core

Auth and storage primitives for the YouVersion Platform React Native (Expo) SDK: installation id, optional PKCE OAuth, and token storage.

## When to use this package

Use `@youversion/platform-react-native-expo-core` when you need:

- ✅ Sign-in via optional PKCE OAuth (`useYVAuth`, `auth` config on the provider)
- ✅ Token storage handled for you (`expo-secure-store` + MMKV)
- ✅ Bible highlights with optimistic writes and an instant local cache (`useHighlights`)

❌ Want ready-made Bible UI instead? Use [@youversion/platform-react-native-expo-ui](https://www.npmjs.com/package/@youversion/platform-react-native-expo-ui).

Install this package directly alongside the UI package. The UI package already depends on core, but a direct dependency is what lets TypeScript resolve the auth APIs, so add it any time your app touches auth. Import Bible components from the UI package; import `useYVAuth` from core.

## Install

```bash
npx expo install @youversion/platform-react-native-expo-core
```

Requires Expo SDK 56+, React 19, and a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go — the SDK relies on native modules). Peer dependencies are listed in [`package.json`](./package.json).

Get your App Key at [platform.youversion.com](https://platform.youversion.com/).

## Documentation and API Reference

- [React Native (Expo) SDK Quick Start](https://developers.youversion.com/sdks/react-native)

## Usage

Configure `auth` on the provider, then read auth state with `useYVAuth`:

```tsx
import { Text } from 'react-native'
import { YouVersionProvider, useYVAuth } from '@youversion/platform-react-native-expo-core'

function Profile() {
  const { isAuthenticated, userInfo, signIn, signOut } = useYVAuth()
  return <Text>{isAuthenticated ? userInfo?.name : 'Signed out'}</Text>
}

export default function App() {
  return (
    <YouVersionProvider appKey="YOUR_APP_KEY" auth={{ redirectUri: 'yourapp://callback' }}>
      <Profile />
    </YouVersionProvider>
  )
}
```

### Permissions

`auth.permissions` asks for YouVersion Platform permissions (e.g. `'highlights'`) at sign-in; the user can decline. Read the grant back with `useYVAuth()`: `hasPermission(permission)`, or `grantedPermissions` for the list (`null` = nothing requested or nothing known yet, `[]` = declined).

To ask an already signed-in user — without making them sign out — call `requestPermissions`:

```tsx
const { hasPermission, requestPermissions } = useYVAuth()

if (!hasPermission('highlights')) {
  const outcome = await requestPermissions(['highlights'])
  // { status: 'granted', grantedPermissions } | { status: 'cancel' }
  // | { status: 'failure', reason: 'not-signed-in' | 'not-permitted' | 'user-changed' | 'in-progress' | 'transient', message }
}
```

A granted permission makes `hasPermission` true on the next render, and merges into the cached grant rather than replacing it.

**Android apps must add `youversionauth` to their `app.json` `scheme` array** (after their own scheme) and rebuild the dev client — the flow returns to the SDK-owned `youversionauth://callback`, and without the scheme registered it reports `cancel`. iOS needs nothing extra.

Once `scheme` is an array, build your OAuth `redirectUri` with the scheme named explicitly — `Linking.createURL('callback', { scheme: 'your-app-scheme' })`. `Linking.createURL` otherwise takes the first array entry, so ordering silently decides your redirect URI.

### Highlights

`useHighlights` gives you a chapter's highlights, cached locally so they paint on the first frame, and write functions that apply optimistically and roll back on failure.

```tsx
import { useHighlights, HIGHLIGHT_COLORS } from '@youversion/platform-react-native-expo-core'

function Reader() {
  const { highlights, apply, remove, isRefreshing, refresh } = useHighlights({
    versionId: 111,
    book: 'JHN',
    chapter: '3',
  })

  async function highlightVerse() {
    const outcome = await apply(HIGHLIGHT_COLORS[0], [16, 17])
    if (outcome.status === 'error' && outcome.reason === 'not-signed-in') {
      // Prompt for sign-in, then retry outcome.failedVerses.
    }
  }

  return <BibleReader versionId={111} book="JHN" chapter="3" highlights={highlights} />
}
```

`highlights` is one entry per verse, ready for the reader's controlled `highlights` prop, and is always safe to render — `isRefreshing` only means a network refresh is in flight, so pair it with `RefreshControl` rather than gating a spinner on it.

Writes resolve to a typed outcome rather than throwing: `{ status: 'ok', verses }`, `{ status: 'noop' }`, or `{ status: 'error', reason, message, failedVerses, succeededVerses }` where `reason` is `'not-signed-in' | 'auth' | 'invalid' | 'transient'`. Branch on `reason`, not `message` — the message is generic outside development builds. `failedVerses` is what to retry; `succeededVerses` being non-empty alongside it means the batch partly landed.

Requires an `auth` config on the provider plus the `highlights` permission, and only the five colors in `HIGHLIGHT_COLORS` are accepted. Signed out, `highlights` is empty and writes return `reason: 'not-signed-in'` without touching state.

## License

This SDK is licensed under [Apache 2.0](./LICENSE).

Licensing information for the Bible versions is available at the [YouVersion Platform](https://platform.youversion.com/) site.

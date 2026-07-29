![License](https://img.shields.io/badge/license-Apache%202.0-blue)

# @youversion/platform-react-native-expo-core

Auth and storage primitives for the YouVersion Platform React Native (Expo) SDK: installation id, optional PKCE OAuth, and token storage.

## When to use this package

Use `@youversion/platform-react-native-expo-core` when you need:

- ✅ Sign-in via optional PKCE OAuth (`useYVAuth`, `auth` config on the provider)
- ✅ Token storage handled for you (`expo-secure-store` + MMKV)
- ✅ Permission state and just-in-time consent (`grantedPermissions`, `hasPermission`, `requestPermission`)
- ✅ Bible highlights with optimistic writes, an instant local cache, and an offline retry queue (`useHighlights`)

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

`AuthConfig.permissions` asks for YouVersion Platform permissions on the consent screen. They are **not** OIDC scopes — they ride in `requested_permissions[]`, and the auth server drops unknown values from `scope`, so a permission listed in `scopes` grants nothing.

```tsx
<YouVersionProvider
  appKey="YOUR_APP_KEY"
  auth={{ redirectUri: 'yourapp://callback', permissions: ['highlights'] }}
>
```

Requesting is not being granted — the user can deny one and sign-in still succeeds. `useYVAuth()` reports the answer and can ask again later:

```tsx
const { grantedPermissions, hasPermission, requestPermission } = useYVAuth()

if (!hasPermission('highlights')) {
  const result = await requestPermission('highlights')
  // { kind: 'granted', permissions } | { kind: 'cancel' } | { kind: 'failure', message }
}
```

`requestPermission` opens YouVersion's hosted consent page in an auth browser session; `kind: 'granted'` means the exchange completed, so check `permissions` for the one you asked for. `grantedPermissions` is `null` when unknown (signed out, or nothing recorded) and distinct from `[]`. The mirror is optimistic — seeded from what was requested at sign-in, persisted per user, and corrected by the server, so a 401/403 on a write is still the ultimate check.

### Highlights

`useHighlights` gives you a chapter's highlights, cached locally so they paint on the first frame, and write functions that apply optimistically and queue for retry when the network is gone.

```tsx
import { useHighlights, HIGHLIGHT_COLORS } from '@youversion/platform-react-native-expo-core'

function VerseHighlighter() {
  const { highlights, apply, remove, isRefreshing, refresh, hasPendingOperations } = useHighlights({
    versionId: 111,
    book: 'JHN',
    chapter: '3',
  })

  async function highlightVerses() {
    const outcome = await apply(HIGHLIGHT_COLORS[0], [16, 17])
    if (outcome.status === 'error' && outcome.reason === 'not-signed-in') {
      // Prompt for sign-in, then retry outcome.failedVerses.
    }
  }

  return <YourHighlightUI highlights={highlights} onApply={highlightVerses} />
}
```

`highlights` is one entry per verse and is always safe to render — `isRefreshing` only means a network refresh is in flight, so pair it with `RefreshControl` rather than gating a spinner on it.

Writes resolve to a typed outcome rather than throwing: `{ status: 'ok', verses }`, `{ status: 'noop' }`, or `{ status: 'error', reason, message, failedVerses, succeededVerses }` where `reason` is `'not-signed-in' | 'auth' | 'invalid' | 'transient'`. Branch on `reason`, not `message` — the message is generic outside development builds. `succeededVerses` being non-empty alongside `failedVerses` means the batch partly landed.

What `failedVerses` means depends on `reason`. For `transient` those verses are **queued and still painted**: the write is persisted to disk and retried with exponential backoff (2s doubling, capped at 30s), surviving an app kill, so treat it as "not saved yet" rather than "failed". For every other reason the paint has already been rolled back and nothing further is attempted.

Highlights revalidate on their own when the scope changes and when the app comes back from the **background**, so one created in the YouVersion Bible App or on another device appears without a restart. Only a real background → foreground transition triggers it — a return from `expo-web-browser` (sign-in, the consent flow) leaves the app `inactive` and is already covered. Call `refresh()` for anything else your app knows about, such as a screen regaining navigation focus; it de-dupes against a fetch already in flight, no-ops when signed out, and never blanks what is already painted.

`hasPendingOperations` is true while that queue is non-empty **or** a write is on the wire. `useYVAuth()` exposes the same fact app-wide as `hasPendingHighlightOperations`, alongside `discardPendingHighlights()` — warn before signing out with unsaved work if you own your own sign-out button. `signOut()` discards the queue and invalidates anything in flight, so a write from the previous session can never land on the next account.

Requires an `auth` config on the provider plus the `highlights` permission, and only the five colors in `HIGHLIGHT_COLORS` are accepted. Signed out, `highlights` is empty and writes return `reason: 'not-signed-in'` without touching state.

Rendering highlights inside the SDK's own reader needs none of this: `BibleReader` from [`@youversion/platform-react-native-expo-ui`](https://www.npmjs.com/package/@youversion/platform-react-native-expo-ui) does the fetching, painting, prompting, and writing itself. Reach for `useHighlights` when you are building your own UI.

## License

This SDK is licensed under [Apache 2.0](./LICENSE).

Licensing information for the Bible versions is available at the [YouVersion Platform](https://platform.youversion.com/) site.

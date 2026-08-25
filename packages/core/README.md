![License](https://img.shields.io/badge/license-Apache%202.0-blue)

# @youversion/platform-react-native-expo-core

Auth, highlights, and storage primitives for the YouVersion Platform React Native (Expo) SDK: installation id, optional PKCE OAuth, token storage, and the Bible highlights hooks.

## When to use this package

Use `@youversion/platform-react-native-expo-core` when you need:

- ✅ Sign-in via optional PKCE OAuth (`useYVAuth`, `auth` config on the provider)
- ✅ Token storage handled for you (`expo-secure-store` + MMKV)
- ✅ Bible highlights with optimistic writes and an instant local cache (`useHighlights`)
- ✅ Highlights made offline that survive a relaunch and land on their own
- ✅ A guarded highlight flow for users who are not signed in yet (`useHighlightPermissionFlow`)

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

### Version filter

Optional lists on `YouVersionProvider` restrict which Bible versions and languages the SDK may use. They are stored on the provider context and forwarded into each DOM component's web `YouVersionProvider` for the web SDK to enforce.

- `permittedVersionIds?: number[]` — unset means no restriction; `[]` means permit nothing
- `excludedVersionIds?: number[]` — exclusion wins over permits
- `permittedLanguageTags?: string[]` — BCP 47 tags (e.g. `en`, `zh-Hans`)

Native chrome does not auto-pick another version or rewrite persisted reader location when a stored or host `versionId` is refused. The id is still passed into the WebView; the web SDK handles version refuse. First-open defaults when there is no stored or host id are unchanged.

```tsx
<YouVersionProvider
  appKey="YOUR_APP_KEY"
  permittedVersionIds={[111, 206]}
  excludedVersionIds={[3034]}
  permittedLanguageTags={['en']}
>
  {/* ... */}
</YouVersionProvider>
```

### Permissions

`auth.permissions` asks for YouVersion Platform permissions (e.g. `'highlights'`) at sign-in; the user can decline. Read the grant back with `useYVAuth()`: `hasPermission(permission)`, or `grantedPermissions` for the list (`null` = nothing requested or nothing known yet, `[]` = declined).

`requestedPermissions` is the other side of that pair — what your app **asked for**, straight from this config, always an array (`[]` when `auth` is unconfigured). Some SDK behavior gates on the request rather than the grant: `useHighlights` issues no network request at all unless `'highlights'` is in this list, so an app that never asks pays nothing.

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

The flow returns to your `redirectUri` — the same callback URL sign-in uses, because an app key has exactly one. Nothing extra to register beyond sign-in's own setup.

If `redirectUri` disagrees with the callback URL registered for your app key, the return never reaches the SDK and the outcome is `cancel`, indistinguishable from a decline.

### Highlights

`useHighlights` gives you a chapter's highlights, cached locally so they paint on the first frame, and write functions that apply optimistically — parking the write when the server cannot be reached, and rolling back only when the server refuses it.

**You do not need this hook to show highlights in `BibleReader`.** That component subscribes to it internally for its own version / book / chapter and paints the result itself — highlights are not a prop you pass. Reach for `useHighlights` when you are building your own reading surface, or when you need the highlight data alongside the reader (a count, a summary, your own verse-action UI).

```tsx
import { useHighlights, HIGHLIGHT_COLORS } from '@youversion/platform-react-native-expo-core'

function HighlightSummary() {
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

  return <Text>{highlights.length} highlighted verses in John 3</Text>
}
```

`highlights` is one entry per verse and is always safe to render — `isRefreshing` only means a network refresh is in flight, so pair it with `RefreshControl` rather than gating a spinner on it. Mounted subscriptions also refresh automatically when the app returns to the foreground (`AppState` → `active`), using the same path as `refresh()`.

Writes resolve to a typed outcome rather than throwing:

- `{ status: 'ok', verses }` — the server took it.
- `{ status: 'queued', verses }` — the server could not be reached. **The highlight is on screen and is owed to the server**, so treat this as a success. See [Highlights made offline](#highlights-made-offline).
- `{ status: 'noop' }` — there was nothing to write.
- `{ status: 'error', reason, message, failedVerses, succeededVerses }` where `reason` is `'not-signed-in' | 'auth' | 'invalid' | 'transient'`. Only this one un-paints.

Branch on `reason`, not `message` — the message is generic outside development builds. `failedVerses` is what to retry; `succeededVerses` being non-empty alongside it means the batch partly landed. `error` on the hook itself is **fetch-only** — writes report through the outcome they resolve to, never through it.

Requires an `auth` config on the provider plus the `highlights` permission. Signed out, `highlights` is empty and writes return `reason: 'not-signed-in'` without touching state.

`apply` accepts only the six colors in `HIGHLIGHT_COLORS` and rejects anything else as `reason: 'invalid'` before painting or issuing a request. That bounds what you can create, not what you can see or clear: a valid non-palette hex already on the account paints normally, and `remove` clears by exact hex whether or not it is in the palette. Only an unparseable hex is dropped from what you see.

#### Highlights made offline

A write that cannot reach the server, or that comes back 5xx, **keeps its paint** and resolves `{ status: 'queued' }`. It is persisted per user and chapter before it is sent, so it is still there after a force-quit, and it reaches the account on its own once service returns — with no user action, and even if the user never goes back to that chapter. Only a server refusal (401, 403, or any other 4xx) reverts the verse.

`queued` reports the write you just made, not the verse's history, so **it repeats**: tapping a verse that is still parked resolves `queued` again. To say "saved offline" only once, hold that in your own state.

Signing out drops every write still waiting, in the same routine that clears the highlights and permission caches. Before offering sign-out, ask whether that will lose anything:

```tsx
import { hasQueuedHighlightWrites, useYVAuth } from '@youversion/platform-react-native-expo-core'

const { userInfo } = useYVAuth()
const willLoseHighlights = hasQueuedHighlightWrites(userInfo?.id ?? null)
```

It reads the queue directly rather than subscribing, and never throws — an unreadable store answers `false`. The UI package's `useSignOutGuard` wires this into a ready-made confirmation.

### Highlighting before signing in

`useHighlightPermissionFlow` wraps `useHighlights` and guards **only `apply`** behind whatever the user is missing — sign-in, the `highlights` permission, or both. It holds the tapped highlight in memory, runs what is needed, and applies it on the way back, so the user never has to reselect the verse. `remove` and everything else pass through untouched.

```tsx
import { useHighlightPermissionFlow } from '@youversion/platform-react-native-expo-core'

const { highlights, apply, isConfirming, confirm, decline, flowError } = useHighlightPermissionFlow(
  { versionId: 111, book: 'JHN', chapter: '3' },
)

// `highlights` is the whole useHighlights result, unmodified —
// render highlights.highlights, and use its remove / refresh / isRefreshing.
```

Drive a consent prompt from `isConfirming`, and route **every** dismissal path — button, backdrop, pan-down — to `decline()`, or the flow is left waiting on an answer that never comes. The hook renders no UI of its own and runs no sign-in prompt; it calls `signIn()` directly, so a sign-in prompt in front of it is yours to add (`BibleReader` in the UI package ships both prompts already wired).

`apply` resolves the write's own `HighlightWriteOutcome` when a write was issued, `{ status: 'noop' }` when the user abandoned the flow, and an `error` only when the flow itself failed — a cancel or a decline is a user choice, not an error, and never appears in `flowError`. A `queued` write passes straight back to you rather than re-prompting: a user who signs in, grants, and then taps with no service gets their paint.

## License

This SDK is licensed under [Apache 2.0](./LICENSE).

Licensing information for the Bible versions is available at the [YouVersion Platform](https://platform.youversion.com/) site.

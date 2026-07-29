---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

`BibleReader` now reads and writes the signed-in user's Bible highlights.

Open a chapter and existing highlights paint on the **first frame** from an MMKV cache — no spinner, no flash of unhighlighted text, and they still paint offline. That includes highlights created in the YouVersion app or on youversion.com. Tapping a swatch in the verse drawer applies it and persists to the user's account; tapping a checkmarked color removes it, leaving other colors on those verses intact. Every tap is gated against the chapter currently on screen, so an intent that lands after the reader moved on is dropped rather than painted into the new chapter.

Highlights stay SDK-owned: there is no new `highlights` prop, and the Web SDK's controlled reader mode remains an internal mechanism rather than a supported surface. Hosts building their own highlight UI should use `useHighlights` from `@youversion/platform-react-native-expo-core`.

**Highlights require the `highlights` _permission_, not a scope.** Configure it on `YouVersionProvider`'s `auth.permissions`. The auth server silently drops unknown values from `scope`, so requesting it there grants nothing and fails invisibly.

## Consent, without losing the tap

A signed-out user who taps a color gets a "Sign in with YouVersion" sheet. A signed-in user who hasn't granted `highlights` gets a just-in-time native alert leading to the hosted consent page. Either way the tap is **held and applied on success**, so the verse never has to be re-selected — and after a permission grant the chapter reloads, so highlights created elsewhere appear alongside it. Every cancellation exit ("No Thanks", swipe-down, backdrop, alert Cancel, denying on the consent page) discards the held highlight. With no `auth` configured, a color tap stays a silent no-op.

## Writes survive a dead network and an app kill

A highlight applied or removed with no connection stays painted, persists to MMKV, and retries with exponential backoff (2s doubling, capped at 30s) until it lands — surviving an app kill, which the reference implementation does not. Only network-shaped failures retry: a rejected payload is dropped, and a permission failure routes to the consent prompt rather than looping. Signing out discards the queue and bumps a generation counter, so a write already in flight for the departed user can never land on the next account.

Signing out with unsaved highlights warns first. `YouVersionAuthButton` and the reader's in-WebView toolbar both check before signing out and show a native alert. Confirming discards that work — it does not try to flush it, which on the dead network that caused the backlog would hang the sign-out the user just asked for.

## Revalidation

`useHighlights` re-fetches when the app returns from the **background** — only a genuine background → foreground transition, since `expo-web-browser` leaves the app `inactive` during sign-in and consent, and the permission flow already refreshes on its own.

Navigation focus is the half the SDK cannot detect without taking `@react-navigation/native` as a peer dependency, so `BibleReader` exposes an imperative handle instead:

```tsx
const reader = useRef<BibleReaderHandle>(null)
useFocusEffect(
  useCallback(() => {
    void reader.current?.refreshHighlights()
  }, []),
)
return <BibleReader ref={reader} />
```

Both paths are safe to fire freely: they de-dupe against a fetch already in flight, no-op when signed out, and never blank what is already painted.

## New in `@youversion/platform-react-native-expo-ui`

`BibleReader` gains four public props and a ref handle:

- **`onVerseSelect`** — fires on every selection change with a bridge-safe payload (`versionId`, `book`, `chapter`, `verses`, per-verse `passageIds`), including `verses: []` when a selection clears. It observes the reader's own selection; nothing you return changes it.
- **`onCopy` / `onShare`** — Copy and Share in the verse drawer now work on device. Both were browser-only before (`navigator.clipboard` and Web Share, neither reliable inside an Expo DOM WebView). Copy writes the curly-quoted verse text plus reference to the system clipboard; Share opens the native share sheet. Pass a handler to take either over — the consumer handler wins and the SDK fallback doesn't run. Failures are swallowed, matching how a dismissed share sheet already behaves.
- **`onHighlightError`** — called when a write fails in a way the user should know about and a retry may help. A `transient` outcome means "queued and retrying", not "didn't save" — the highlight stays painted and survives an app kill, so render it as a pending or offline hint rather than a failure. Payload errors are logged instead; the user can't act on them.
- **`ref.current.refreshHighlights()`**, typed as the newly exported **`BibleReaderHandle`**.

**`expo-clipboard` is a new peer dependency and requires a dev-client rebuild.** A JS-only reload cannot link native code, so an existing dev client will redbox with `Cannot find native module 'ExpoClipboard'`:

```bash
npx expo install expo-clipboard
npx expo prebuild --clean -p ios && pnpm build:ios   # or -p android
```

`expo-application` is also now a peer dependency, used to put the app's own display name in the sign-in sheet's copy. It needs no rebuild — core already required it.

## New in `@youversion/platform-react-native-expo-core`

**`useHighlights()`** is the public hook for reading and writing highlights directly. It paints from the MMKV cache synchronously on first render, applies and removes optimistically, and reconciles against the server. `apply(color, verses)` and `remove(color, verses)` return a typed `HighlightWriteOutcome` — `ok`, `noop`, or `error` with a `reason` of `not-signed-in` / `auth` / `invalid` / `transient`, plus `failedVerses` and `succeededVerses` so a partially-applied batch is legible. For `transient`, `failedVerses` are queued and **still painted**; for every other reason their paint has been reverted.

Also exported: `deriveServerColors` (projects highlights to a verse → color map, expanding range passage ids such as `JHN.3.16-18`), `HIGHLIGHT_COLORS` and `isHighlightColor` (the five company-standard swatches — both write paths reject anything else), `refresh()` / `isRefreshing` for pull-to-refresh, `hasPendingOperations`, and the `HighlightScope` / `ServerColors` / `Highlight` types. The highlights API wrapper and the MMKV cache stay internal.

**`useYVAuth()`** now reports and requests permissions:

- **`grantedPermissions: AuthPermission[] | null`** — what this device believes the signed-in user granted, scoped to that user and persisted in MMKV so it survives a cold start. `null` means _unknown_ (signed out, or nothing recorded) and is deliberately distinct from `[]` ("we asked and were granted nothing").
- **`hasPermission(permission)`** — the synchronous read the highlight flow gates on.
- **`requestPermission(permission)`** — the just-in-time grant. Opens the hosted consent page in an auth browser session, resolving to `{ kind: 'granted', permissions }`, `{ kind: 'cancel' }`, or `{ kind: 'failure', message }` (also exported as `RequestPermissionResult`). `granted` means the exchange completed, not that your permission was in it — check `permissions`. The grant is discarded if the signed-in user changed while the browser was open.
- **`hasPendingHighlightOperations`** and **`discardPendingHighlights()`** — so a host that owns its own sign-out can build the same warning.

The permission mirror is **optimistic**: sign-in seeds it from the permissions the app requested, because the sign-in callback carries no grant echo. The server is still the ultimate check — a highlight write that comes back 401/403 drops the `highlights` grant, so the next attempt prompts instead of failing the same way.

`AuthPermission` is now an **open** string union (the listed values still autocomplete, unknown ones type-check), matching the Swift SDK, so a permission minted after this release round-trips intact instead of being dropped or forcing a major version. The closed list remains available as `KnownAuthPermission`. Not a breaking change for code that passes or reads permission values; only an exhaustive `switch` over `AuthPermission` needs a default case.

## Docs

Both READMEs now cover the flow end to end: what `BibleReader` does on its own, the permission-vs-scope trap, reading grants back, the new props, and `expo-clipboard` alongside the other native peers. Two corrections: the core README no longer shows a `highlights` prop on `BibleReader`, and the note that granted permissions "are not exposed yet" is gone, because they are.

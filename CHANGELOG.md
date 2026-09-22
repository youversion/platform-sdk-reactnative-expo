# Changelog

All notable changes to the YouVersion Platform React Native (Expo) SDK.

`@youversion/platform-react-native-expo-core` and
`@youversion/platform-react-native-expo-ui` are a `fixed` group in `.changeset/config.json`,
so they share a version number and release together. Each entry below notes which packages
it affected.

Generated from the per-package changelogs by `scripts/build-root-changelog.mjs` — edit those,
or the changeset, rather than this file.

## 1.6.0

### Minor Changes

- _(@youversion/platform-react-native-expo-ui)_ 040d231: feat: name `tokens.radius` by role — `surface` (16, web `rounded-2xl`) and `full` (pill) — and drop the `sm`/`md`/`lg`/`xl` steps ported from web's shadcn calc ramp, which only Button read and which rendered as a pill anyway. Adds the internal `Card` compound primitive on `radius.surface`.

  ## Migration

  `tokens.radius.md` (and `sm` / `lg` / `xl`) maps to `tokens.radius.full`. Surfaces use `tokens.radius.surface`.

  ## Released as minor, not major

  `radius` reaches consumers through the public `getTokens` / `useTokens` / `Tokens`
  surface, so dropping the size keys is technically a breaking type change. It ships
  as `minor` deliberately: the ramp went public one release ago in 1.5.0, the design
  system is still being built out, and no consumer reads `tokens.radius` yet.

### Patch Changes

- _(@youversion/platform-react-native-expo-ui)_ 233dc86: fix: YouVersionProvider holds children until bundled Inter registers, then native text always draws Inter. First paint waits on that local load. Theme toggles must not ellipsize button labels or drop a line from multi-line text.

- _(@youversion/platform-react-native-expo-ui)_ a32975d: Sync localization from platform-localization (0ae8cca): update 29 keys in en.

- _(@youversion/platform-react-native-expo-ui)_ cd9b2ff: Sync localization from platform-localization (5225dbc): update 1 keys in en.

- _(@youversion/platform-react-native-expo-ui)_ 2dc28cc: fix: derive native sheet chrome from design tokens (YPE-5271). Handle, muted labels, stroke, and shadows now resolve from palette / semantic tokens instead of copied hex. A small shift on the handle and supporting labels is expected where the old hex sat off-palette.

- _(@youversion/platform-react-native-expo-ui)_ b57174d: Replace auth-button hex with design tokens (YPE-5272). Border, fill, and label colors resolve from border/background/foreground for the background prop's scheme. Borders and white surfaces stay byte-identical; pure-black values move to #121212.

- _(@youversion/platform-react-native-expo-ui)_ 52b742e: feat: add internal Tabs, Accordion, and Popover primitives (YPE-5439 / RNV2-1). Token-styled wrappers around `@rn-primitives` 1.4.0 (same line as the existing portal). Picker/chrome use only; not public API.

- _(@youversion/platform-react-native-expo-ui)_ 3247134: fix: resolve BibleTextView light/dark on native and pass that scheme into the in-WebView provider (YPE-5442 / RNV2-4). Font size and family stay consumer props; `fontFamily` still crosses as an ADR 0009 token, not a `getTokens` value.

  Standalone `BibleTextView` now uses the same content-sized embed defaults as `BibleCard` / `VerseOfTheDay` (`matchContents`, `flex: 0`, scroll off). Pass `dom={{ matchContents: false }}` to opt out and size with flex styles.

## 1.5.0

### Minor Changes

- _(@youversion/platform-react-native-expo-core)_ 80d3718: Bible content is cached on device (YPE-5262). The Bible Content Client reads a per-version MMKV store before fetching and writes each 2xx body back with the lifetime the response's `Cache-Control` declares — `max-age` less `Age`, seven days when no usable `max-age` is present, and no write at all for `no-cache`, `no-store`, or a lifetime of zero — so previously read chapters, pickers, and BibleCard content render without a network, including offline. Content is scoped to the app key and survives sign-out.

- _(all packages)_ 553757e: Native owns Bible content requests (YPE-5510). Core exposes a Bible Content Client and a required `fetchBibleContent` action on the provider context; the UI package weaves it under each DOM component's `fetch`, so eligible `/v1/bibles/*` requests cross the bridge and run natively with `X-YVP-Sdk: ReactNativeSDK=<version>` headers. The SDK version stamp moves from ui to core (`@youversion/platform-react-native-expo-core/sdk-version`).

- _(all packages)_ 5805e95: feat: replace the native highlight apply palette with the six YPE-5058 hexes, mix verse-action dots against `SHEET_SURFACE` via `mixSrgb`, and pin `@youversion/platform-react-ui` to 2.12.0 so reader fill and Words of Christ match that release (YPE-5059). Apply stays palette-only. Leftover `fffe00` still paints and clears. WOC stays unmixed `#94000C` / `#e4bfc2`.

- _(all packages)_ 3dfe296: feat: load Inter, Untitled Serif, and Source Serif 4 from `YouVersionProvider` (YPE-5266)

  `YouVersionProvider` registers brand fonts in the background with `expo-font`. Untitled Serif is fetched from the Fonts API (`GET /v1/fonts/1` with `X-YVP-App-Key`). Inter and Source Serif 4 come from Google Font packages. There is no opt-out and no public fonts-ready hook. Children still render while fonts load. If Untitled Serif cannot load, native serif falls back to Source Serif 4.

  ## Action required

  Install the new `expo-font` peer and rebuild the dev client. A JS-only reload shows `Cannot find native module`.

  ```bash
  npx expo install expo-font
  ```

- _(@youversion/platform-react-native-expo-ui)_ a1f5751: feat: export `getTokens` with locally owned light/dark design tokens ported from the web theme (YPE-5264). Palette and semantic maps stay internal. Does not change live sheet or auth-button colors.

- _(@youversion/platform-react-native-expo-ui)_ 3758182: feat: export `useTokens` from YouVersionProvider theme context (YPE-5265).

- _(@youversion/platform-react-native-expo-ui)_ 9c8003b: feat: expose `typography` size scale on `Tokens` via `useTokens` (YPE-5268).

## 1.4.0

### Minor Changes

- _(all packages)_ dd11c3f: Export `hookOverrides` on `YouVersionProvider` as a test seam, plus the `HookOverrides` and `AuthContextValue` types. Production apps leave `hookOverrides` unset.

- _(@youversion/platform-react-native-expo-ui)_ de27302: feat: expose BibleCard `maxWidth` (`number | '100%'`) and forward it to the web card (YPE-5197). Pin `@youversion/platform-react-ui` to 2.10.0 so the WebView runs the published card (platform-sdk-react#354). Native only forwards the prop; scripture fill (`--yv-reader-max-width: none` on the painted section) stays web-owned.

## 1.3.1

### Patch Changes

- _(@youversion/platform-react-native-expo-ui)_ f5501f8: fix: omit verse-action highlight colors when `auth` is not configured, so a kids app without sign-in still gets Copy and Share instead of dead swatches.

- _(@youversion/platform-react-native-expo-ui)_ 9d90e75: fix: forward resolved provider locale into DOM WebViews so in-WebView copy matches native SDK language.

## 1.3.0

### Minor Changes

- _(all packages)_ 7388cbe: feat: paint host highlights on BibleTextView, BibleCard, and VerseOfTheDay

  Subscribe those surfaces at chapter scope and always pass Highlight[] into the DOM so paint uses the native cache.

- _(all packages)_ f88fd12: Add optional version filter lists to `YouVersionProvider`: `permittedVersionIds`, `excludedVersionIds`, and `permittedLanguageTags`. The UI provider forwards them through native wrappers into each DOM web `YouVersionProvider`. Pin `@youversion/platform-react-ui` and `@youversion/platform-core` to 2.8.0 so the web SDK enforces those lists in Expo DOM WebViews (YPE-4657/YPE-4658).

## 1.2.0

### Minor Changes

- _(all packages)_ 624d008: Bible highlights on native. The reader paints the highlights of the signed-in user. Verse actions are a native bottom sheet. Highlights made offline survive a relaunch and land on their own. A user who taps a color before sign-in or grant still gets that highlight.

  ## Action required

  Install three new peer modules and rebuild the dev client. A JS-only reload shows `Cannot find native module`.

  ```bash
  npx expo install expo-network expo-clipboard expo-application
  ```

  - `expo-network` is a core peer. It wakes parked writes when connectivity returns.
  - `expo-clipboard` is a UI peer. It is the Copy fallback in the verse action sheet.
  - `expo-application` is a UI peer. It supplies the app name on the sign-in sheet. Core no longer depends on it.

  CAUTION: The default serif font of the reader changes from Source Serif 4 to Untitled Serif. The WebView fetches a stylesheet from `api.youversion.com` and font files from `cdn.youversion.com`. There is no opt-out. If those hosts are blocked, serif text falls back to Source Serif 4. Readers who chose Source Serif are migrated. Any other `fontFamily` you pass is left untouched.

  ## BibleReader

  `BibleReader` owns highlights on native. It reads `useHighlights` for the current passage and passes the result as a controlled prop. The WebView does not fetch highlights, store them, or hold a token.

  A verse selection opens a native sheet with the reference, color swatches, Copy, and Share. No new prop turns this on.
  - Swatches: a remove circle for each color on the selection, then an apply circle for the palette colors not already covering the selection.
  - Sign-in and consent: the sheet asks for whatever is missing, then applies the chosen color. This needs `auth.permissions` to include `highlights`.
  - Copy and Share fall back to `expo-clipboard` and React Native `Share`. Optional `onCopy` and `onShare` take either over. Both receive `BibleReaderShareData`.

  The sheet has no backdrop. A backdrop blocks the next verse tap. The user dismisses the sheet with a swipe down, a deselect, or an action on the sheet. Themed sheets draw an upward drop shadow so the sheet still separates from the page.

  Selection across the bridge:
  - `onVerseSelect(selection)` fires on every change, including a clear (`verses: []`).
  - `clearSelectionSignal` dismisses the selection from native. The host increments the value. The value at mount is the baseline.

  `BibleReaderVerseSelection` and `BibleReaderShareData` are re-exported from this package.

  `ref.refreshHighlights()` re-fetches the current passage. A screen that regains focus can call it.

  `onHighlightError` reports `{ status: 'queued' }` and `{ status: 'error', reason: 'transient' }` only. Other outcomes stay silent. The `HighlightWriteError` type is exported.

  Sign-out from the reader menu and from `YouVersionAuthButton` asks first. If parked writes are still waiting, the alert is "Save your highlights?". The Confirm action calls `signOut()`. `useYVAuth().signOut()` still signs out at once. `useSignOutGuard` is exported for a host sign-out UI. `hasQueuedHighlightWrites(userId)` chooses the alert variant and never throws.

  On web, the Web SDK popover is the verse-action UI. Sign-out is unprompted because `Alert.alert` is a no-op on React Native Web.

  ## useHighlights

  `useHighlights({ versionId, book, chapter })` is the public surface for highlight data. It paints from an MMKV cache on the first render. `apply` and `remove` are optimistic. If the server refuses a write, the paint reverts.

  `apply` and `remove` resolve a `HighlightWriteOutcome`: `ok`, `noop`, `queued`, or `error`. `queued` is new. It is a `minor` because no existing status changed meaning. An exhaustive `switch` with no `default` is the only consumer branch that breaks. An `error` carries `reason` (`not-signed-in` / `auth` / `invalid` / `transient`) plus `failedVerses` and `succeededVerses`. The hook `error` is fetch-only.

  Also exported: `deriveServerColors`, `HIGHLIGHT_COLORS`, `isHighlightColor`, `refresh()`, and the `Highlight` / `HighlightColor` / `HighlightScope` / `ServerColors` types.

  `apply` accepts only the five palette colors. A valid non-palette hex already on the account paints and clears by exact value. An unparseable hex is dropped.

  `isRefreshing` means a GET is in flight. `highlights` is always safe to render. Mounted subscriptions also refresh when the app becomes active.

  The GET runs only for an app that requested the `highlights` permission on `YouVersionProvider`. The gate reads the requested list, not a grant.

  ## Offline writes

  A tap with no service keeps its paint and parks the write. The write is stored per user and chapter. It survives a relaunch. When service returns, the write lands.
  - Unreachable or 5xx: paint stands. Outcome is `{ status: 'queued', verses }`.
  - 401, 403, or any other 4xx: paint reverts. Outcome reports the refusal.

  `queued` repeats on every tap of a verse that is still parked. If you show "saved offline" once, hold that copy in your own state.

  Sign-out drops every parked write with the highlights cache and the grant cache. A write parked on one account cannot land on the next account.

  A 401 or 403 on the drain earns one forced refresh and one retry. Only a second auth refusal under a minted token drops the entry. A failed force drops nothing.

  ## Highlighting before sign-in

  `useHighlightPermissionFlow` wraps `useHighlights` and guards `apply`. It holds the pending highlight, runs sign-in and/or consent, then applies. `remove` passes through.

  It returns the `useHighlights` result plus `isConfirming`, `confirm()`, `decline()`, and `flowError`. A cancel or decline resolves `noop`. `BibleReader` already wires the prompts. This hook is for a custom highlight UI.

  This needs `auth` on `YouVersionProvider` and the `highlights` permission. With no `auth`, the flow behaves as signed out.

  ## Permissions and tokens

  `useYVAuth()` now reports `grantedPermissions`, `hasPermission()`, `invalidatePermissions()`, and `requestedPermissions`. `grantedPermissions` is `null` (unknown), `[]` (denied), or a list (granted). The grant is read from the OAuth app redirect and cached per user.

  `requestPermissions(permissions)` asks a signed-in user for a grant without sign-out. It resolves a `DataExchangeOutcome` and never throws: `granted`, `cancel`, or `failure` (`not-signed-in` / `not-permitted` / `user-changed` / `in-progress` / `transient`). The grant merges. The consent page returns to your `redirectUri`. If that URI does not match the registered callback, the outcome is `cancel`.

  The cached grant is a hint. A privileged action gates on the pre-flight, not on a cached `true`.

  `getAccessToken(options?)` resolves `{ status: 'ok', token, userId }` or `{ status: 'unavailable', reason: 'signed-out' | 'refresh-failed' }`. It refreshes only near expiry unless you pass `{ force: true }`. It never rejects. `refresh-failed` keeps the session. Highlights writes and `requestPermissions` treat `refresh-failed` as `transient` and do not send the request.

  ## Dependencies

  `@youversion/platform-core` and `@youversion/platform-react-ui` move to 2.6.2. That release supplies controlled highlights, data-exchange primitives, and a fix that reads an empty-body 2xx DELETE as success.

### Patch Changes

- _(@youversion/platform-react-native-expo-core)_ 2902934: Installation IDs are now a random UUID persisted in MMKV, not the device identifier (iOS IDFV / Android `ANDROID_ID`). Kids' apps that ship this SDK must not transmit persistent device IDs under COPPA; this matches the Swift, Kotlin, and React web SDKs. Existing stored installation IDs are left unchanged. `expo-application` is no longer a peer dependency of core. `YouVersionProvider` resolves the installation ID synchronously, so the `fallback` prop is unused.

## 1.1.1

### Patch Changes

- _(@youversion/platform-react-native-expo-ui)_ 0726f7a: Sync localization from platform-localization (15b2da1): add French (fr); update 15 keys in en.

## 1.1.0

### Minor Changes

- _(@youversion/platform-react-native-expo-core)_ 89a4e50: Partners can now request YouVersion Platform permissions at sign-in. `AuthConfig` gains an optional `permissions` field typed by the new exported `AuthPermission` union (`'bibles' | 'highlights' | 'votd' | 'demographics' | 'bible_activity'`), and the PKCE flow appends each requested value to `/auth/authorize` as a repeated `requested_permissions[]` param — deduped and sorted, and omitted entirely when no permissions are configured. Permissions are deliberately kept separate from `scopes`: they are not OIDC scopes, and the auth server silently drops unknown values from `scope`, so requesting one there would grant nothing. This ships the request side only — reading back which permissions the user actually granted arrives in a later release.

### Patch Changes

- _(@youversion/platform-react-native-expo-ui)_ f0057ca: Syncs additional native UI locales from platform-localization (Czech, Finnish, Hungarian, Italian, Dutch, Norwegian, Serbian, Ukrainian) and registers them in the SDK locale catalog. Norwegian device tags (`nb` / `nn`) now resolve to the bundled `no` resource.

## 1.0.0

### Major Changes

- _(all packages)_ ce283a0: Release 1.0.0 — the first stable release of the YouVersion Platform React Native Expo SDK.

  This is a milestone version bump marking the SDK's official 1.0 launch. There are no breaking API changes from 0.9.1; the major bump signifies the transition to a stable, publicly supported release line.

## 0.9.1

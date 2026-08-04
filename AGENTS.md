# AGENTS.md

## Project Overview

YouVersion Platform React Native Expo SDK — wraps the React Web SDK (`@youversion/platform-react-ui`) as Expo DOM components for use in React Native apps. Two published packages in a pnpm/Turborepo monorepo: `@youversion/platform-react-native-expo-ui` (components) and `@youversion/platform-react-native-expo-core` (auth, storage).

**Tech stack**: Expo SDK 56, React 19, TypeScript 6, pnpm 11, Turborepo

## Supply-Chain Protection

- **Cooldown**: `minimumReleaseAge: 4320` (3 days) in `pnpm-workspace.yaml` — package versions published less than 3 days ago are rejected (mitigates hijacked-release supply-chain attacks). Workspace packages (`workspace:*`) are inherently exempt. It is enforced at **two** points:
  1. **Resolution** — fails with `ERR_PNPM_NO_MATURE_MATCHING_VERSION`. **`--force` does not override it**; use `pnpm install --config.minimumReleaseAge=0`, which lifts the cooldown for whatever that one command resolves.
  2. **Lockfile verification** — every install re-checks the committed `pnpm-lock.yaml` against the policy and fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. This runs on `--frozen-lockfile` too, so **CI is not exempt**, and neither is `pnpm exec` / turbo (their deps-status check shells out to `pnpm install`). Overriding at resolution is therefore *not* local-only: a lockfile carrying a too-new version reds CI until the package ages past the cutoff, at which point the same lockfile passes with no changes.

  `minimumReleaseAgeExclude` exempts packages permanently, and accepts scope globs. **`@youversion/*` is excluded** — the cooldown buys time for the ecosystem to spot a hijacked *third-party* release, but for the Web SDK we publish ourselves it only blocks us from consuming our own work on release day. Those packages lean on publish-side controls (2FA/trusted publishing) instead. Everything else keeps the full 3 days.
- **Exact pins**: `dependencies` and `devDependencies` use exact versions (no `^`/`~`). This matters most in `packages/ui` and `packages/core` — their published manifests are resolved fresh on consumers' machines, where our lockfile offers no protection. `peerDependencies` stay as ranges by design (satisfied by the host app).
- **Build scripts**: pnpm 11 blocks dependency postinstall scripts unless approved in `allowBuilds` (`pnpm-workspace.yaml`). If an install reports ignored builds, decide explicitly — prefer `false` when the package ships prebuilt binaries (e.g. `unrs-resolver`).
- **Version bumps**: when updating a third-party pin, pick a version published ≥3 days ago — otherwise CI stays red until it ages past the cutoff (see the two enforcement points above). `@youversion/*` bumps are exempt and can land on release day. Update cadence is defined separately.
- `expo install --fix` writes `~`-ranged versions back into `package.json` — after using it, re-pin the exact versions it chose.

## Release

Releases use [Changesets](https://github.com/changesets/changesets), matching the flow in [`platform-sdk-react`](https://github.com/youversion/platform-sdk-react). Run `pnpm changeset` on PRs that should ship. Merging to `main` triggers `.github/workflows/release.yml`, which either opens a "Version Packages" PR (when changesets are pending) or publishes both packages atomically (when the Version PR merges). See [PUBLISHING.md](./PUBLISHING.md) for the full flow and [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md) for RN-specific failure modes.

## Setup Commands

```bash
pnpm install                          # install all workspace deps
cd apps/example && pnpm build:ios     # build dev client (first time)
cd apps/example && pnpm build:android # Android dev client alternative
cd apps/example && pnpm exec expo start --dev-client  # start dev server (after build)
pnpm build                            # turbo build (expo-module build compiles each package to build/ for publish)
pnpm typecheck                        # turbo typecheck (all packages)
pnpm test                             # turbo test
pnpm lint                             # eslint
pnpm format:check                     # prettier check
```

## Project Structure

```
packages/ui/src/
├── dom/          ← Expo DOM components ("use dom" directive) wrapping Web SDK
├── native/       ← React Native provider/context, wrappers, and internal sheet support
└── lib/          ← Shared adapters, hooks, constants (dom-error)

packages/core/src/
├── auth/         ← Auth config, PKCE, OAuth/storage key constants
└── storage/      ← MMKV + SecureStore adapters

apps/example/     ← Expo Router tabs app consuming the SDK via workspace:*
```

## Development Workflow

- First native run: `cd apps/example && pnpm build:ios` (or `pnpm build:android`) — creates and installs a dev client with native modules
- Subsequent runs: `cd apps/example && pnpm exec expo start --dev-client`
- Example app requires `EXPO_PUBLIC_YOUVERSION_APP_KEY` in the environment or an `.env` file
- Source entry (`"main": "src/index.ts"`) — Metro resolves TypeScript directly for local dev; publishing compiles to `build/` via `expo-module-scripts` (see [ADR 0011](docs/adr/0011-compiled-distribution.md))
- **Expo Go is not supported** — requires a dev build
- **Adding a native module (any new Expo/RN native dep in `packages/ui`, `packages/core`, or the example) requires rebuilding the dev client.** JS-only reload (`expo start --dev-client`) cannot link native code, so the installed binary goes stale. Symptom: a runtime redbox `Cannot find native module 'X'` even though the package is installed and appears in `ios/Podfile.lock`. Fix — regenerate native and relink (`apps/example/ios` is gitignored CNG output, so `--clean` is safe):
  ```bash
  cd apps/example
  npx expo prebuild --clean -p ios && pnpm build:ios   # or -p android
  ```
  A plain `pnpm build:ios` (incremental) can miss it; when in doubt, `prebuild --clean`. Don't reach for `expo install --fix` — that only reconciles package versions, not a stale/unlinked pod.
- **Fresh git worktree checklist.** A new worktree carries no untracked state: run `pnpm install` at the **worktree root** first (iOS pods resolve via `:path: "../../../node_modules/<pkg>"` into _that worktree's_ `node_modules` — without the install, autolinking silently skips those pods), copy `apps/example/.env` (gitignored) from another checkout, and expect a full dev-client rebuild if the installed binary predates any native dep on the branch.
- **Metro's transform cache is shared across worktrees and can poison Expo DOM bundling.** The cache lives in `$TMPDIR/metro-cache` (machine-global), and the DOM transformer bakes **absolute source paths** into generated `expo/dom/entry.js` proxies. Sibling worktrees have byte-identical `packages/ui/src/dom/*.tsx` files, so Metro in one worktree can hit cached proxies pointing into another worktree — outside its project root. Symptom: `Unable to resolve "./../../../../../../<other-worktree>/packages/ui/src/dom/<file>.tsx" from "apps/example/node_modules/expo/dom/entry.js"` / `DOM Bundling failed`, even though every file exists. Fix — restart Metro with a cache clear from the worktree you're working in:
  ```bash
  cd apps/example && pnpm exec expo start --dev-client -c
  ```
  Reach for `-c` whenever a DOM bundling error names a path from a different worktree; nothing short of a cache clear evicts the stale proxies.

## Key Architecture Notes

### Expo DOM Components

DOM components use the `'use dom'` directive (Expo SDK 56). They render in a WebView-based DOM environment that provides `localStorage` (Android needs a shim — see below), `DOMParser`, CSS injection. **Never** use Web SDK components directly in React Native; always go through a DOM component wrapper.

The optional `dom` prop is forwarded to the underlying WebView. In SDK 56 the default backing WebView is **`@expo/dom-webview`** (purpose-built for DOM components), not `react-native-webview`. Use the [React Native WebView API Reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md) for `style`, `containerStyle`, `scrollEnabled`, `contentInset` / `contentInsetAdjustmentBehavior`, injected script props, and the rest — `@expo/dom-webview` mirrors that surface. Expo-only fields (e.g. `matchContents`) come from `DOMProps` in `expo/dom`, not that document. Consumers can opt back into `react-native-webview` per-component via `dom={{ useExpoDOMWebView: false }}`.

#### Android: `localStorage` is null in the DOM WebView (blank-render fix)

On Android, `@expo/dom-webview`'s native `DomWebView.kt` enables JavaScript and file access but **never sets `WebSettings.domStorageEnabled`, which defaults to `false`**. With DOM storage off, `window.localStorage` evaluates to **`null`** (not `undefined`). The Web SDK's `YouVersionProvider` and our `applySDKConfig` call `localStorage.getItem`/`setItem`, so on Android they throw, the DOM error boundary catches it, and the component renders **blank** (the native WebView is present and painting an empty page). iOS (WKWebView) and `react-native-webview` both default DOM storage **on**, so this only regressed when SDK 56 made `@expo/dom-webview` the default backing WebView. `@expo/dom-webview` exposes no prop to flip it, and `typeof null === 'object'` means a `typeof localStorage !== 'undefined'` guard does not catch it.

Fix (shipped in this package): an in-memory `Storage` shim in `lib/dom-local-storage.ts` (`ensureDomLocalStorage()`), self-installing on import and invoked from `lib/web-yv-provider.ts` (imported first by all DOM components) so it is in place before the Web SDK module evaluates. `dom-apply.ts` also guards with `localStorage != null`. The shim is per-WebView/non-persistent, which is fine: DOM WebViews are long-lived (pre-warmed) and the installation id is re-supplied from native props on every mount. Long-term fix is upstream — `@expo/dom-webview` should enable `domStorageEnabled`.

### Native Provider

`YouVersionProvider` is the public root provider. It supplies native context for `appKey` and resolved theme, and wraps the internal `NativeSheetProvider` so consumers only need one SDK provider.

Keep `GestureHandlerRootView` outside `YouVersionProvider`; bottom-sheet gestures need it as an ancestor.

### Native Wrappers

`BibleCard`, `VerseOfTheDay`, `BibleReader`, and `BibleTextView` read `appKey` from `YouVersionProvider`, then pass serializable `appKey` and theme props into their DOM wrappers. Component-level theme props remain valid overrides.

`BibleCard` and `BibleReader` are stateful — they own `versionId` (via `useControllableState`) and coordinate picker sheets. When `showVersionPicker` is enabled and `onVersionPickerPress` is omitted, they open a built-in `BibleVersionPickerSheet`; when a handler is provided, the consumer handles the press and no sheet renders. On `BibleCard`, `showVersionPicker` defaults to `false` (matching the Web SDK), so consumers must opt in before either path applies.

### Version Picker Sheet

`BibleVersionPickerSheet` → `bible-version-picker-content.tsx` (**Version Picker Shell Layout**). Native passes `versionId`, `resetKey`, theme, and `onVersionChange` (commit + close). Language panel visibility is **DOM-owned** — do not lift to native or bridge as a **Native Action** (first open will flash; see `docs/adr/0005-dom-owned-language-panel-in-version-picker.md`).

When handling `BibleVersionPickerLanguageTrigger` `onClick` in the DOM file, call `event.preventDefault()` so Web SDK `setIsLanguagesOpen` does not run alongside the shell cross-fade.

Panel transition classes live in `lib/version-picker-panels.ts` (layer-1 tests). Native sheet tests assert language state is not passed across the bridge.

Raw DOM components are not part of the package API.

Native provider context does not cross into Expo DOM WebViews. DOM wrappers keep their own web `YouVersionProvider` from `@youversion/platform-react-ui`.

### NativeSheet Portal Pattern

Portal via `@rn-primitives/portal` + a local zustand store in `native/native-sheet.tsx` instead of `<Modal>`. Modal unmounts children when hidden, destroying WebViews (~500ms cold-start).

Each `NativeSheet` portals its own `BottomSheet` to the root host. Do not hide inactive DOM/WebView content in a 1×1 wrapper; that breaks `matchContents` measurement.

Inactive `NativeSheet` hosts may remain mounted for WebView pre-warming, but they must stay inert. Android applies the offscreen/no-chrome/no-gestures/no-pointer-events treatment; iOS intentionally keeps the default closed host so `matchContents` WebViews can pre-warm and measure correctly (see `docs/adr/0006-inactive-sheet-inertness.md`).

`NativeSheet` currently exposes `enableContentPanningGesture`, Android loader controls, and content styling. Add typed `@gorhom/bottom-sheet` keyboard pass-throughs only when a sheet needs them, and cover the native action/sheet contract in tests.

A soft keyboard raised by a search input inside an Expo DOM WebView cannot be dismissed from native: RN's `Keyboard.dismiss()` only blurs the focused RN `TextInput` (via `TextInputState`), and the WebView's HTML input is invisible to it, so the call is a no-op. Instead, the picker DOM components (`dom/bible-version-picker-content.tsx`, `dom/chapter-picker-content.tsx`) receive the sheet's `isOpen` and, via `useDismissKeyboardOnClose` (`lib/dom-dismiss-keyboard.ts`), blur `document.activeElement` inside the WebView when `isOpen` flips to false (Cancel, pan-down, backdrop, and displacement all drive `isOpen` false). This is a one-way native→DOM command on close, not bridged UI state. See `docs/adr/0010-dom-keyboard-dismissal-on-sheet-close.md`.

### FootnoteContent Pre-warming

Mounted immediately with empty placeholder data to cold-start the WebView during page load.

### Font/Theme Overrides

CSS custom properties on `[data-slot="yv-bible-renderer"]`: `--yv-reader-font-size`, `--yv-reader-font-family`, `--yv-reader-bg`, `--yv-reader-fg`

### Metro Config

Keep `apps/example/metro.config.js` minimal — just `getDefaultConfig(__dirname)`. Expo SDK 52+ auto-configures monorepo support. **Don't** manually set `watchFolders` or `resolver.`\*.

### Entry Point

`apps/example/index.js` re-exports `expo-router/entry` — required for Metro monorepo resolution.

### TypeScript

- Root `tsconfig.json` excludes `apps/example`
- Each workspace's `tsconfig.json` is its **build** config, extending `expo-module-scripts/tsconfig.base` (not the root) with `outDir: build` and tests excluded; a sibling `tsconfig.test.json` extends it to re-include tests for `pnpm typecheck` (see [ADR 0011](docs/adr/0011-compiled-distribution.md))
- The base enables stricter flags (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`) — use type-only imports and guard indexed access
- `nodeLinker: hoisted` in `pnpm-workspace.yaml` is required for Expo DOM + pnpm compatibility (pnpm 11 only reads auth/registry settings from `.npmrc`)

## Exports

**UI** (`@youversion/platform-react-native-expo-ui`): `YouVersionProvider`, `BibleCard`, `BibleChapterPickerSheet`, `BibleReader`, `BibleReaderSettingsSheet`, `BibleTextView`, `BibleVersionPickerSheet`, `VerseOfTheDay`, and `YouVersionAuthButton`

**Core** (`@youversion/platform-react-native-expo-core`): `YouVersionProvider` (installation id + optional auth), `useYouVersion`, `useYVAuth` (its value carries `grantedPermissions` / `hasPermission` / `invalidatePermissions` / `requestPermissions` alongside the sign-in surface), `useHighlights`, `deriveServerColors`, `HIGHLIGHT_COLORS` / `isHighlightColor`, `mmkvStorage`, auth types (`AuthConfig`, `AuthPermission`, `KnownAuthPermission`, `AuthScope`, `DataExchangeOutcome`, `DataExchangeFailureReason`, `YVUserInfo`), and highlights types (`Highlight`, `HighlightScope`, `ServerColors`, `HighlightWriteOutcome`, `HighlightsFetchError`, `UseHighlightsOptions`, `UseHighlightsResult`)

UI `YouVersionProvider` wraps core and adds theme context + `NativeSheetProvider`. Import Bible components from UI; import `useYVAuth` from core.

## Auth (core)

- Optional PKCE OAuth when `auth: { redirectUri, scopes?, permissions? }` is passed to core `YouVersionProvider` (forwarded by UI provider).
- On RN, `permissions` is configured on `YouVersionProvider`'s `auth` config (not on `YouVersionAuthButton` / `signIn()`), unlike web. The example app stays scopes-only until the permission flow lands (C3).
- **Requesting a permission is not being granted it.** `useYVAuth()` reads the grant back: `hasPermission(permission)` for a single check, `grantedPermissions` for the list, and `invalidatePermissions()` to drop a stale grant after a 401/403 so the next pre-flight re-prompts. Three states, and collapsing them loses "the user said no": `null` = nothing requested / unknown, `[]` = requested and denied, populated = granted.
- The grant rides only on the **app redirect** — the `/auth/callback` `Location` hop drops it — so `pkce-flow.ts` parses it from `result.url` before that hop, and a test in `__tests__/pkce-flow.test.ts` pins the ordering. It is then cached per user in MMKV (redirect parsing in `auth/granted-permissions.ts`, the cache in `auth/granted-permissions-cache.ts`), seeded synchronously in a `useState` initializer so it is correct on the first render, and purged in `clearAuthState`. `AuthPermission` is an open union and cached values are kept verbatim, not filtered — filtering would turn a server-side addition into a silent denial.
- `useYVAuth().requestPermissions(permissions)` is the **just-in-time grant** (data exchange): a signed-in user grants a permission on the spot, no sign-out. Mint (`POST /data-exchange/token`, 201) → hosted consent in an auth session → parse the return → merge into the grant cache. Resolves to a `DataExchangeOutcome` (`granted` / `cancel` / `failure` with `reason: 'not-signed-in' | 'not-permitted' | 'user-changed' | 'transient'`) and never throws. Permission-generic — nothing highlights-specific lives in `auth/data-exchange.ts`.
  - The grant **merges**, never replaces: a `highlights`-only consent must not erase a previously granted `votd`. `cancel` and `failure` never touch the cache.
  - An **initiator guard** fails closed: an `AuthIdentity` (`{ sessionId, userId }`) is captured before minting and re-read after the browser returns; any difference discards the grant (`reason: 'user-changed'`). `sessionId` is a local counter compared only for equality, not a server-issued value; it moves only in `setIdentity` (sign-in and sign-out), so a token-only `setAuthState` leaves it alone and a mid-flow refresh passes. `userId` alone cannot carry the guard because `null` means both "signed out" and "signed in with no `sub`". A same-session id-less user passes deliberately — failing closed there locks those users out of the flow entirely.
  - **The guard is a backstop, not a defence against user action** — worth knowing before you either delete it as dead weight or trust it as a security boundary. Neither platform lets the user reach the app while the consent page is up (iOS is a modal sheet; on Android foregrounding resolves the auth session as `dismiss` first, ending the flow). The paths that _can_ land mid-flow are not user-driven — a revoked token tripping `clearAuthState`, or app code calling `signOut` from async work — and all of them end signed out, where `saveGrantedPermissions` already refuses the null `userId`. What the guard actually buys: a truthful **outcome** (never `granted` for a user who has left, which is what consumers branch on) and a `requestDataExchange` that is correct on its own terms instead of depending on a null check in `granted-permissions-cache.ts` that nothing links to it.
  - `status: 'granted'` reports what the server granted, which may not be everything asked for. Check the returned list (or `hasPermission`) for the permission you needed.
  - **Never throws is load-bearing and easy to break.** Every doc for this flow tells consumers not to `try`/`catch`, so each `await` that can reject needs a guard returning a `transient` failure: the mint (in `data-exchange-api.ts`), `WebBrowser.openAuthSessionAsync` (which rejects on a session already open, a missing native module, or no Android activity for the intent), and `getOrSetInstallationId()` in the provider. Tests pin all three.
  - **One flow at a time.** `requestPermissions` shares a single in-flight promise via a ref, so a double-tap does not mint a second token, open a second auth session, or race the first to write the grant cache. Overlapping callers get the same outcome; the lock releases as the promise settles.
  - The return URL is the hardcoded, SDK-owned `youversionauth://callback` — **not** the app's `redirectUri`. **Android consumers must add `youversionauth` to their `app.json` `scheme` array** or the flow silently reports `cancel`; iOS needs nothing. See [ADR 0015](docs/adr/0015-data-exchange-return-scheme.md).
  - **A multi-entry `scheme` array makes `Linking.createURL`'s default unsafe.** It uses the first entry and warns about the rest, so an OAuth `redirectUri` built without an explicit `{ scheme }` is decided by array ordering — put `youversionauth` first and sign-in breaks against a console registration that never changed. Docs and the example app pass the scheme explicitly; keep it that way.
- **The cached grant is a hint, not an authority** ([ADR 0014](docs/adr/0014-cached-grant-is-a-hint.md)). `hasPermission` chooses UI and skips redundant prompts; the server enforces. Under MMKV failure a revoked grant can survive — clearing is best-effort by design, because it must never break sign-out — so a privileged action gates on the pre-flight, never on a cached `true`. Read the ADR before "fixing" `clearGrantedPermissions`.
- `useYVAuth()` throws if `auth` was not configured on the provider.
- `YouVersionAuthButton` (UI package) is the drop-in sign-in/sign-out button built on `useYVAuth`; use it for standard sign-in UI instead of hand-rolling a button.
- Tokens in `expo-secure-store`; expiry and cached user info in MMKV (`packages/core/src/storage/`).
- OAuth browser session via `expo-web-browser`; redirect handling is app-owned (example: `apps/example/app/callback.tsx` + `Linking.createURL('callback')`).
- Register the same `redirectUri` in the YouVersion Platform console as used in app code.

## Highlights (core)

- `useHighlights({ versionId, book, chapter })` is the whole public surface. The `createHighlightsApi` wrapper over `@youversion/platform-core`'s `HighlightsClient`, the MMKV cache, and the local `Result` seam (`packages/core/src/result.ts`) all stay internal.
- Requires `auth` on `YouVersionProvider` and the `highlights` **permission** (see the permissions note above — highlights go in `requested_permissions[]`, never in `scope`). With no auth configured it behaves exactly as signed out.
- Paints from the MMKV cache **synchronously** in a `useState` initializer. That only works because `AuthProvider` seeds `userInfo` from its own initializer, so `userInfo.id` exists on the first render — load-bearing coupling, commented at both ends.
- `highlights` is always safe to render. `isRefreshing` means "a GET is in flight", never "no data yet"; gating a spinner on it reintroduces the blank first frame the cache exists to prevent.
- `error` is **fetch-only**. Writes report once, through the `HighlightWriteOutcome` they resolve to — that is also C3's branch point for the sign-in prompt (`reason === 'auth'` / `'not-signed-in'`).
- The five swatches in `HIGHLIGHT_COLORS` are a company standard enforced in core: both `apply` and `remove` reject anything else as `invalid` before painting or issuing a request. Do not relax this on layering grounds — the open improvement is relocating the palette to `@youversion/platform-core`, not deferring it to the UI layer.
- Overlay math lives in the pure, React-free `packages/core/src/highlights/optimistic.ts`, ported from the web highlights machine. Ownership tokens and the colour-aware overlay retirement rule are documented in [ADR 0013](docs/adr/0013-native-highlights-optimistic-layer.md); the retirement rule reads like a bug in both directions and is defended only by its regression pair, so read the ADR before touching `shouldRetire`.

## Runtime Dependencies

**UI** bundles: `@radix-ui/react-use-controllable-state`, `@rn-primitives/portal`, `zustand`, `@youversion/platform-react-hooks`, `@youversion/platform-react-ui`, and `@youversion/platform-react-native-expo-core`.

**Core** bundles: `expo-application`, `expo-crypto`, `expo-web-browser`.

Native modules and app-owned framework packages are peer dependencies. Consumers must install peer dependencies from both `packages/ui/package.json` and `packages/core/package.json` with Expo-compatible versions. Expo SDK 56 apps should also include `@expo/dom-webview` for Expo DOM Components and `react-native-worklets` when using Reanimated 4.

## Peer Dependencies

See `packages/ui/package.json` and `packages/core/package.json` `peerDependencies` for the canonical list. Requires a dev build (not Expo Go).

## Testing

Jest with jest-expo preset configured in `packages/ui/package.json`. Test files in `__tests__` directories alongside source. `jest.setup.js` provides `global.nativeModuleProxy` for RN 0.85 compatibility.

### Testing layers

Four layers map to Expo DOM Components' architecture. We own layers 1 and 3.

1. **Pure logic** — plain Jest unit tests for state reducers, prop builders, action handlers. No framework.
2. **DOM component tests** — `@testing-library/react` + jsdom testing `'use dom'` internals. **Not our responsibility** — the Web SDK owns DOM behavior. Add a separate jsdom Jest project only if we need to test SDK-authored DOM behavior (e.g. **Version Picker Shell Layout** / **Chapter Picker Shell Layout** CSS, `visualViewport` keyboard handling). Prefer extracting shell logic to `lib/` and testing layer 1 (see `version-picker-panels.ts`, `resolve-theme.ts`).
3. **Native screen tests** — `jest-expo` + `@testing-library/react-native` with DOM components **mocked as RN primitives**. This is our primary layer. Test native action contracts, orchestration, theme resolution, and error gating. Not prop forwarding or framework mechanics.
4. **E2E/device tests** — Maestro/Detox on a built app. Validates the real native/DOM bridge. Not set up yet.

### Conventions

- Mock DOM components inside `jest.mock()` factories using `require('react-native')` — never render real DOM components in RNTL.
- Mock `NativeSheet` with `jest.requireActual` spread to preserve `NativeSheetProvider`.
- Prefer `userEvent` over `fireEvent` for new tests.
- Use `latestDomProps` capture pattern to assert what crosses the native/DOM boundary.
- Wrap async native action calls in `act(async () => { ... })`.

## Code Style

- TypeScript strict mode
- No non-null assertions (`x!`) in source — ESLint enforces `@typescript-eslint/no-non-null-assertion` as an error (relaxed in tests). Narrow with a guard instead
- Components live in `packages/ui/src/`; auth and storage live in `packages/core/src/`
- Re-export from barrel files (`index.ts`) at each directory level
- Use `expo install --fix` to resolve Expo package version conflicts, then re-pin the resulting `~` ranges to exact versions (see Supply-Chain Protection)

## Native UI localization

User-visible strings in `packages/ui/src/native/**` must be localized. Follow this **before** opening a PR — Greptile enforces it at **high** severity:

- **Use the hook.** Render copy with `useSdkTranslation()` → `t('key')`, or `<Trans i18nKey="key">` for rich text. This covers `Text` children, `accessibilityLabel`/`accessibilityHint`, `placeholder`, SDK-set `Alert` strings, and SDK-owned `headerTitle` values — never hardcode them.
- **Add keys upstream, not here.** New keys go under `reactnative.*` in [platform-localization](https://github.com/youversion/platform-localization) (`sources/common/en.json`). Do **not** hand-edit `packages/ui/src/i18n/locales/*.json` — those files are generated and synced, and `SdkTranslationKey` types update automatically after sync.
- **Exempt.** `packages/ui/src/dom/**` (WebView Bible UI stays English — [ADR 0009](./docs/adr/0009-deferred-dom-localization.md)), consumer-provided prop overrides, test files, and non-user-facing literals (test IDs, logs, style tokens).

Full guide: [docs/contributing/native-i18n.md](./docs/contributing/native-i18n.md); enforcement rules: `.greptile/rules.md`.

## Recommended Agent Skill

This repo uses `CONTEXT.md` and `docs/adr/` for domain language and architectural decisions. Before planning changes, use the [grill-with-docs](https://www.skills.sh/mattpocock/skills/grill-with-docs) skill to stress-test your plan against the documented domain model — it challenges terminology and updates docs inline as decisions crystallize.

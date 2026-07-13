# AGENTS.md

## Project Overview

YouVersion Platform React Native Expo SDK — wraps the React Web SDK (`@youversion/platform-react-ui`) as Expo DOM components for use in React Native apps. Two published packages in a pnpm/Turborepo monorepo: `@youversion/platform-react-native-expo-ui` (components) and `@youversion/platform-react-native-expo-core` (auth, storage).

**Tech stack**: Expo SDK 56, React 19, TypeScript 6, pnpm 9, Turborepo

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

`BibleCard` and `BibleReader` are stateful — they own `versionId` (via `useControllableState`) and coordinate picker sheets. When `onVersionPickerPress` is omitted, they open a built-in `BibleVersionPickerSheet`; when provided, the consumer handles the press and no sheet renders.

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
- `node-linker=hoisted` in `.npmrc` is required for Expo DOM + pnpm compatibility

## Exports

**UI** (`@youversion/platform-react-native-expo-ui`): `YouVersionProvider`, `BibleCard`, `BibleChapterPickerSheet`, `BibleReader`, `BibleReaderSettingsSheet`, `BibleTextView`, `BibleVersionPickerSheet`, `VerseOfTheDay`, `YouVersionAuthButton`, and the `DEFAULT_BIBLE_VERSION_ID` constant (3034, Berean Standard Bible)

**Core** (`@youversion/platform-react-native-expo-core`): `YouVersionProvider` (installation id + optional auth), `useYouVersion`, `useYVAuth`, `mmkvStorage`, and auth types (`AuthConfig`, `AuthScope`, `YVUserInfo`)

UI `YouVersionProvider` wraps core and adds theme context + `NativeSheetProvider`. Import Bible components from UI; import `useYVAuth` from core.

## Auth (core)

- Optional PKCE OAuth when `auth: { redirectUri, scopes? }` is passed to core `YouVersionProvider` (forwarded by UI provider).
- `useYVAuth()` throws if `auth` was not configured on the provider.
- `YouVersionAuthButton` (UI package) is the drop-in sign-in/sign-out button built on `useYVAuth`; use it for standard sign-in UI instead of hand-rolling a button.
- Tokens in `expo-secure-store`; expiry and cached user info in MMKV (`packages/core/src/storage/`).
- OAuth browser session via `expo-web-browser`; redirect handling is app-owned (example: `apps/example/app/callback.tsx` + `Linking.createURL('callback')`).
- Register the same `redirectUri` in the YouVersion Platform console as used in app code.

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
- Use `expo install --fix` to resolve Expo package version conflicts

## Native UI localization

User-visible strings in `packages/ui/src/native/**` must be localized. Follow this **before** opening a PR — Greptile enforces it at **high** severity:

- **Use the hook.** Render copy with `useSdkTranslation()` → `t('key')`, or `<Trans i18nKey="key">` for rich text. This covers `Text` children, `accessibilityLabel`/`accessibilityHint`, `placeholder`, SDK-set `Alert` strings, and SDK-owned `headerTitle` values — never hardcode them.
- **Add keys upstream, not here.** New keys go under `reactnative.*` in [platform-localization](https://github.com/youversion/platform-localization) (`sources/common/en.json`). Do **not** hand-edit `packages/ui/src/i18n/locales/*.json` — those files are generated and synced, and `SdkTranslationKey` types update automatically after sync.
- **Exempt.** `packages/ui/src/dom/**` (WebView Bible UI stays English — [ADR 0009](./docs/adr/0009-deferred-dom-localization.md)), consumer-provided prop overrides, test files, and non-user-facing literals (test IDs, logs, style tokens).

Full guide: [docs/contributing/native-i18n.md](./docs/contributing/native-i18n.md); enforcement rules: `.greptile/rules.md`.

## Recommended Agent Skill

This repo uses `CONTEXT.md` and `docs/adr/` for domain language and architectural decisions. Before planning changes, use the [grill-with-docs](https://www.skills.sh/mattpocock/skills/grill-with-docs) skill to stress-test your plan against the documented domain model — it challenges terminology and updates docs inline as decisions crystallize.

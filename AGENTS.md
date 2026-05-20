# AGENTS.md

## Project Overview

YouVersion Platform React Native Expo SDK — wraps the React Web SDK (`@youversion/platform-react-ui`) as Expo DOM components for use in React Native apps. Single published package `@youversion/platform-react-native-expo` in a pnpm/Turborepo monorepo.

**Tech stack**: Expo SDK 55, React 19, TypeScript, pnpm 9, Turborepo

## Setup Commands

```bash
pnpm install                          # install all workspace deps
cd apps/example && pnpm build:ios     # build dev client (first time)
cd apps/example && pnpm exec expo start --dev-client  # start dev server (after build)
pnpm build                            # turbo build (all packages)
pnpm typecheck                        # turbo typecheck (all packages)
```

## Project Structure

```
packages/ui/src/
├── dom/          ← Expo DOM components ("use dom" directive) wrapping Web SDK
├── native/       ← React Native provider/context, wrappers, and internal sheet support
└── lib/          ← Shared adapters, hooks, constants (storage, dom-error)

apps/example/     ← Expo Router tabs app consuming the SDK via workspace:*
```

## Development Workflow

- First build: `cd apps/example && pnpm build:ios` (or `build:android`) — creates a dev client with native modules
- Subsequent runs: `cd apps/example && pnpm exec expo start --dev-client`
- Source entry (`"main": "src/index.ts"`) — no build step, Metro resolves TypeScript directly
- **Expo Go is not supported** — requires a dev build

## Key Architecture Notes

### Expo DOM Components

DOM components use the `'use dom'` directive (Expo SDK 55). They render in a WebView-based DOM environment that provides `localStorage`, `DOMParser`, CSS injection. **Never** use Web SDK components directly in React Native; always go through a DOM component wrapper.

The optional `dom` prop is forwarded to the underlying React Native `WebView` (Expo owns `source`). Use the [React Native WebView API Reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md) for `style`, `containerStyle`, `scrollEnabled`, `contentInset` / `contentInsetAdjustmentBehavior`, injected script props, and the rest. Expo-only fields (e.g. `matchContents`) come from `DOMProps` in `expo/dom`, not that document.

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

Optional `keyboardBehavior`, `keyboardBlurBehavior`, `android_keyboardInputMode`, and `enableBlurKeyboardOnGesture` pass through to `@gorhom/bottom-sheet` for sheets that host inputs (e.g. chapter picker WebView + keyboard).

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
- Each workspace has its own `tsconfig.json` extending root
- `node-linker=hoisted` in `.npmrc` is required for Expo DOM + pnpm compatibility

## Exports

**Components**: `YouVersionProvider`, `BibleCard`, `BibleChapterPickerSheet`, `BibleReader`, `BibleReaderSettingsSheet`, `BibleTextView`, `BibleVersionPickerSheet`, `VerseOfTheDay`

## Runtime Dependencies

Bundled (no install needed): `@rn-primitives/portal`, `zustand`, `@youversion/platform-react-hooks`, `@youversion/platform-react-ui`. Consumers must install peer dep `@gorhom/bottom-sheet`.

## Peer Dependencies

See `packages/ui/package.json` `peerDependencies` for the canonical list. Requires a dev build (not Expo Go).

## Testing

Jest with jest-expo preset configured in `packages/ui/package.json`. Test files in `__tests__` directories alongside source. `jest.setup.js` provides `global.nativeModuleProxy` for RN 0.83 compatibility.

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
- Single published package — keep all exports in `packages/ui/src/`
- Re-export from barrel files (`index.ts`) at each directory level
- Use `expo install --fix` to resolve Expo package version conflicts

## Recommended Agent Skill

This repo uses `CONTEXT.md` and `docs/adr/` for domain language and architectural decisions. Before planning changes, use the [grill-with-docs](https://www.skills.sh/mattpocock/skills/grill-with-docs) skill to stress-test your plan against the documented domain model — it challenges terminology and updates docs inline as decisions crystallize.

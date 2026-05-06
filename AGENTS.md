# AGENTS.md

## Project Overview

YouVersion Platform React Native Expo SDK — wraps the React Web SDK (`@youversion/platform-react-ui`) as Expo DOM components for use in React Native apps. Single published package `@youversion/platform-react-native-expo` in a pnpm/Turborepo monorepo.

**Tech stack**: Expo SDK 55, React 19, TypeScript, pnpm 9, Turborepo

## Setup Commands

```bash
pnpm install                          # install all workspace deps
cd apps/example && pnpm build:ios     # build dev client (first time)
cd apps/example && pnpm start         # start dev server (after build)
pnpm build                            # turbo build (all packages)
pnpm typecheck                        # turbo typecheck (all packages)
```

## Project Structure

```
packages/ui/src/
├── dom/          ← Expo DOM components ("use dom" directive) wrapping Web SDK
├── native/       ← React Native components (sheets, portal provider, wrappers)
└── lib/          ← Shared adapters, hooks, constants

apps/example/     ← Expo Router tabs app consuming the SDK via workspace:*
```

## Development Workflow

- First build: `cd apps/example && pnpm build:ios` (or `build:android`) — creates a dev client with native modules
- Subsequent runs: `cd apps/example && pnpm start`
- The package uses source entry (`"main": "src/index.ts"`) — no build step needed during dev, Metro resolves TypeScript directly
- **Expo Go is not supported** — native modules (`react-native-gesture-handler`, `react-native-reanimated`, `@gorhom/bottom-sheet`) require a dev build

## Key Architecture Notes

### Expo DOM Components

DOM components use the `'use dom'` directive (Expo SDK 55). They render in a WebView-based DOM environment that provides `localStorage`, `DOMParser`, CSS injection — things that don't exist natively. **Never** try to use Web SDK components directly in React Native; always go through a DOM component wrapper.

### Native Wrappers (BibleReader, BibleTextView)

The primary exports (`BibleReader`, `BibleTextView`) are **native wrappers** that compose:
- A DOM component (the web SDK reader/text view, rendered in a WebView)
- A `NativeSheet` for footnotes (portaled to the app root)
- State management for footnote open/close

The raw DOM components are also exported as `BibleReaderDOM` and `BibleTextViewDOM` for direct use.

### NativeSheet Portal Pattern

`NativeSheet` uses a context-based portal instead of React Native's `<Modal>`. This is because:
- **Modal unmounts children** when `visible={false}`, destroying the inner WebView
- WebViews take ~500ms+ to cold-start, causing a blank flash on every sheet open
- The portal keeps children mounted at the app root, so the WebView stays warm

This follows Shopify's MobileBridge architecture: keep WebViews alive and reuse them.
See: https://shopify.engineering/mobilebridge-native-webviews

The portal is implemented via `NativeSheetProvider` (rendered at app root) and `NativeSheet` (portal client that syncs children to the provider via context). Both live in `native/native-sheet.tsx`.

### FootnoteContent Pre-warming

The native wrappers mount `FootnoteContent` (a DOM component) immediately with empty placeholder data. This cold-starts the WebView during page load, not when the user taps a footnote. Subsequent opens are prop updates to an already-warm WebView.

### Font/Theme Overrides

CSS custom properties on `[data-slot="yv-bible-renderer"]`:

- `--yv-reader-font-size`
- `--yv-reader-font-family`
- `--yv-reader-bg`
- `--yv-reader-fg`

### Metro Config

Keep `apps/example/metro.config.js` minimal — just `getDefaultConfig(__dirname)`. Expo SDK 52+ auto-configures monorepo support. **Don't** manually set `watchFolders` or `resolver.`*.

### Entry Point

`apps/example/index.js` re-exports `expo-router/entry` — required for Metro monorepo resolution.

### TypeScript

- Root `tsconfig.json` excludes `apps/example`
- Each workspace has its own `tsconfig.json` extending root
- `node-linker=hoisted` in `.npmrc` is required for Expo DOM + pnpm compatibility

### Peer Dependencies

The SDK requires these as peer dependencies:
- `react >=19`, `react-dom >=19`, `react-native`
- `react-native-webview` — for Expo DOM components
- `@gorhom/bottom-sheet >=5` — for the native sheet
- `react-native-gesture-handler >=2.16.1` — required by gorhom
- `react-native-reanimated >=3.16.0` — required by gorhom

## Testing

No test framework configured yet. When adding tests, use Jest and configure at the package level.

## Code Style

- TypeScript strict mode
- Single published package — keep all exports in `packages/ui/src/`
- Re-export from barrel files (`index.ts`) at each directory level
- Use `expo install --fix` to resolve Expo package version conflicts

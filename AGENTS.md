# AGENTS.md

## Project Overview

YouVersion Platform React Native Expo SDK — wraps the React Web SDK (`@youversion/platform-react-ui`) as Expo DOM components for use in React Native apps. Single published package `@youversion/platform-react-native-expo` in a pnpm/Turborepo monorepo.

**Tech stack**: Expo SDK 55, React 19, TypeScript, pnpm 9, Turborepo

## Setup Commands

```bash
pnpm install                          # install all workspace deps
cd apps/example && pnpm start         # start example app (Expo dev server)
pnpm build                            # turbo build (all packages)
pnpm typecheck                        # turbo typecheck (all packages)
```

## Project Structure

```
packages/ui/src/
├── dom/          ← Expo DOM components ("use dom" directive) wrapping Web SDK
├── native/       ← React Native components (sheets, pickers, screens)
└── lib/          ← Shared adapters, hooks, constants

apps/example/     ← Expo Router tabs app consuming the SDK via workspace:*
```

## Development Workflow

- Start the example app: `cd apps/example && pnpm start`
- Platform targets: `pnpm ios`, `pnpm android`, `pnpm web` (from `apps/example/`)
- The package uses source entry (`"main": "src/index.ts"`) — no build step needed during dev, Metro resolves TypeScript directly

## Key Architecture Notes

### Expo DOM Components

DOM components use the `'use dom'` directive (Expo SDK 55). They render in a WebView-based DOM environment that provides `localStorage`, `DOMParser`, CSS injection — things that don't exist natively. **Never** try to use Web SDK components directly in React Native; always go through a DOM component wrapper.

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

The SDK requires `react >=19`, `react-dom >=19`, `react-native`, and `react-native-webview` as peers.

## Testing

No test framework configured yet. When adding tests, use Vitest and configure at the package level.

## Code Style

- TypeScript strict mode
- Single published package — keep all exports in `packages/ui/src/`
- Re-export from barrel files (`index.ts`) at each directory level
- Use `expo install --fix` to resolve Expo package version conflicts


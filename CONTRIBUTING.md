# Contributing to YouVersion Platform React Native Expo SDK

## Contribution policy

Thanks for your interest in contributing.

We’re **not yet accepting pull requests** from external contributors. This is temporary while we stabilize the SDK. In the meantime, feedback and bug reports are very welcome.

### How you can help right now

- **Use the SDK**: try it in an Expo app and share feedback
- **Report bugs**: open a [GitHub issue](https://github.com/youversion/platform-sdk-reactnative-expo/issues)
- **Platform issues** (API keys, rate limits, etc.): contact [YouVersion Platform Support](https://platform.youversion.com/support)

---

## Development setup

The sections below are for internal development of this repo.

## Prerequisites

- Node.js >= 20
- pnpm 9+
- Expo SDK 55+

## Setup

```bash
# Install deps
pnpm install

# Start the example app (Expo dev server)
cd apps/example
pnpm start
```

## Useful commands

```bash
# Build all packages (turbo)
pnpm build

# Typecheck all packages (turbo)
pnpm typecheck
```

From `apps/example/`:

```bash
pnpm ios
pnpm android
pnpm web
```

## Repo structure (high level)

```text
packages/ui/src/
  dom/     Expo DOM components ("use dom") wrapping the React Web SDK
  native/  React Native components (sheets, pickers, screens)
  lib/     Shared adapters, hooks, constants

apps/example/  Expo Router app consuming the SDK via workspace:*
```

## Project notes / guidelines

- **Expo DOM**: DOM components use `'use dom'` and run in a WebView-like DOM environment. Don’t render React Web SDK components directly in native; wrap them as DOM components.
- **Exports**: single published package; keep exports in `packages/ui/src/` and re-export via barrel `index.ts` files.
- **Metro**: keep `apps/example/metro.config.js` minimal (`getDefaultConfig(__dirname)` only). Don’t add custom `watchFolders`/`resolver.`\*.

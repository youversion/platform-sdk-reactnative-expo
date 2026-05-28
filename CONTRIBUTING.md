# Contributing to YouVersion Platform React Native Expo SDK

## Contribution Policy

Thanks for your interest in contributing.

We are **not yet accepting pull requests** from external contributors while we stabilize the SDK. Feedback and bug reports are welcome.

### How You Can Help Right Now

- **Use the SDK**: try it in an Expo app and share feedback.
- **Report bugs**: open a [GitHub issue](https://github.com/youversion/platform-sdk-reactnative-expo/issues).
- **Platform issues**: for API keys, rate limits, or account support, contact [YouVersion Platform Support](https://platform.youversion.com/support).

## Development Setup

The sections below are for internal development of this repo.

### Prerequisites

- Node.js >= 20
- pnpm 9
- Expo SDK 55
- A YouVersion Platform API key for running the example app
- A dev build for native development; Expo Go is not supported

This repo uses `node-linker=hoisted` in `.npmrc` for Expo DOM and pnpm compatibility.

### Install Dependencies

```bash
pnpm install
```

### Run the Example App

Set `EXPO_PUBLIC_YOUVERSION_APP_KEY` in your environment or an `.env` file before starting the example app.

Build the dev client the first time:

```bash
cd apps/example
pnpm build:ios
```

Or for Android:

```bash
cd apps/example
pnpm build:android
```

After the dev client is installed, start the dev server:

```bash
cd apps/example
pnpm exec expo start --dev-client
```

## Useful Commands

From the repo root:

```bash
pnpm build          # turbo build
pnpm typecheck      # turbo typecheck
pnpm test           # turbo test
pnpm lint           # eslint
pnpm lint:fix       # eslint --fix
pnpm format:check   # prettier check
pnpm format         # prettier write
```

From `apps/example/`:

```bash
pnpm build:ios      # expo run:ios
pnpm build:android  # expo run:android
pnpm ios            # expo run:ios
pnpm android        # expo run:android
pnpm web            # expo start --web
pnpm typecheck      # tsc --noEmit
```

From `packages/ui/`:

```bash
pnpm typecheck      # tsc --noEmit
pnpm test           # jest --passWithNoTests
pnpm test:watch     # jest --watchAll
pnpm test:coverage  # jest --coverage
```

## Repo Structure

```text
packages/ui/src/
  dom/     Expo DOM components ("use dom") wrapping the React Web SDK
  native/  React Native provider, wrappers, picker sheets, and sheet support
  lib/     Shared adapters, hooks, constants, and pure logic

apps/example/  Expo Router app consuming the SDK via workspace:*
```

## Project Notes

- **Expo DOM**: DOM components use `'use dom'` and run in Expo's DOM/WebView runtime. Do not render React Web SDK components directly in React Native; wrap them as Expo DOM components.
- **Provider setup**: `GestureHandlerRootView` must wrap `YouVersionProvider` so bottom-sheet gestures have the right native ancestor.
- **Exports**: this repo contains one package, `@youversion/platform-react-native-expo`; keep public exports in `packages/ui/src/` and re-export through barrel files.
- **Metro**: keep `apps/example/metro.config.js` minimal with `getDefaultConfig(__dirname)` only. Expo SDK 52+ handles monorepo support.
- **Distribution**: the package is source-only. Metro resolves TypeScript directly so Expo can process `'use dom'` directives from package source.

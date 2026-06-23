# Contributing to YouVersion Platform React Native Expo SDK

## Contribution Policy

Thanks for your interest in contributing.

We are **not yet accepting pull requests** from external contributors while we stabilize the SDK. Feedback and bug reports are welcome.

### How You Can Help Right Now

- **Use the SDK**: try it in an Expo app and share feedback.
- **Report bugs**: open a [GitHub issue](https://github.com/youversion/platform-sdk-reactnative-expo/issues).
- **Platform issues**: for API keys, OAuth redirect URIs, rate limits, or account support, contact [YouVersion Platform Support](https://platform.youversion.com/support).

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

For auth flows, register the example redirect URI (`Linking.createURL('callback')` for scheme `yvp-rn-example`) in the YouVersion Platform console. The sample app wires this in `apps/example/app/_layout.tsx` and handles the redirect in `apps/example/app/callback.tsx`.

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
pnpm web            # expo start --web
pnpm typecheck      # tsc --noEmit
```

From `packages/ui/` or `packages/core/`:

```bash
pnpm typecheck      # tsc --noEmit
pnpm test           # jest
pnpm test:watch     # jest --watchAll
pnpm test:coverage  # jest --coverage
```

## Repo Structure

```text
packages/ui/src/
  dom/     Expo DOM components ("use dom") wrapping the React Web SDK
  native/  React Native provider, wrappers, picker sheets, and sheet support
  lib/     Shared adapters, hooks, constants, and pure logic

packages/core/src/
  auth/      PKCE OAuth, token storage, useYVAuth
  storage/   MMKV and SecureStore adapters

apps/example/  Expo Router app consuming both packages via workspace:*
```

## Project Notes

- **Packages**: `@youversion/platform-react-native-expo-ui` (components) and `@youversion/platform-react-native-expo-core` (provider, auth, storage). The example app depends on both; UI re-exports the public component API and wraps the core provider.
- **Expo DOM**: DOM components use `'use dom'` and run in Expo's DOM/WebView runtime. Do not render React Web SDK components directly in React Native; wrap them as Expo DOM components.
- **Provider setup**: `GestureHandlerRootView` must wrap `YouVersionProvider` so bottom-sheet gestures have the right native ancestor.
- **Exports**: keep public exports in each package's `src/index.ts` barrel files. Auth hooks and types live in core; Bible components live in UI.
- **Metro**: keep `apps/example/metro.config.js` minimal with `getDefaultConfig(__dirname)` only. Expo SDK 52+ handles monorepo support.
- **Distribution**: packages are source-only. Metro resolves TypeScript directly so Expo can process `'use dom'` directives from package source.
- **Native UI localization**: user-visible strings in `packages/ui/src/native/**` must use `useSdkTranslation()` and keys in `en.json` — see [docs/contributing/native-i18n.md](./docs/contributing/native-i18n.md).

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

- Node.js >= 24 (an `.nvmrc` is provided, so `nvm use` picks the right version)
- pnpm >= 11
- Expo SDK 56
- A YouVersion Platform API key for running the example app
- A dev build for native development; Expo Go is not supported

This repo uses `nodeLinker: hoisted` in `pnpm-workspace.yaml` for Expo DOM and pnpm compatibility.

For supply-chain protection, `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (a 3-day cooldown) — installs reject package versions published less than 3 days ago — and dependencies are pinned to exact versions. See the Supply-Chain Protection section in [AGENTS.md](./AGENTS.md).

### Install Dependencies

```bash
pnpm install
```

### Run the Example App

Set `EXPO_PUBLIC_YOUVERSION_APP_KEY` in your environment or an `.env` file before starting the example app.

For auth flows, register `youversionauth://callback` as the callback URI for your app key in the YouVersion Platform console. The sample app declares it in `apps/example/app/_layout.tsx` and handles the redirect in `apps/example/app/callback.tsx`; `app.json` carries the matching `"scheme": "youversionauth"` so Android can route it.

An app key has exactly one callback URI, and both browser round-trips — sign-in and the data-exchange permission grant — come back through it. If the value in `_layout.tsx` and the console entry disagree, sign-in fails with `invalid_request` and permission grants silently report `cancel`.

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

> **Added a native dependency?** Rebuild the dev client. Restarting the dev server only reloads JS — it can't link new native code, so the installed app goes stale. The tell is a runtime redbox `Cannot find native module 'X'` even though the package is installed (and listed in `ios/Podfile.lock`). `apps/example/ios` is generated (gitignored), so a clean regen is safe:
>
> ```bash
> cd apps/example
> npx expo prebuild --clean -p ios && pnpm build:ios   # or -p android
> ```
>
> This applies whenever a native module is added to `packages/ui`, `packages/core`, or the example app. `expo install --fix` won't help here — it only reconciles versions, not an unlinked pod.

### Device builds on BrowserStack

When an approved collaborator on `platform-sdk-reactnative-expo_automation`
opens a PR from a branch in this repository, **BrowserStack App Live PR
Build** dispatches the existing automation build for the PR's exact head
commit — Android **and** iOS. New commits do not rebuild automatically. To
upload the current PR head again, an approved collaborator comments one of
the following on the open PR:

| Comment                   | Platforms rebuilt   |
| ------------------------- | ------------------- |
| `/app-live <sha>`         | Android **and** iOS |
| `/app-live-ios <sha>`     | iOS only            |
| `/app-live-android <sha>` | Android only        |

`<sha>` is the full 40-character sha of the head commit being approved, and
the comment must contain nothing else. The single-platform commands are
cheaper/faster for iterating on a platform-specific change — matching
`build-rn-app.yml`'s own guidance to pick a single target rather than always
paying for both. On any of these explicit rebuild paths, the commenter
authorizes that one same-repository revision; the PR author does not also
need access to the automation repository. The automation repository builds
the example app's `.apk` and/or `.ipa` for whichever platform(s) were
requested, uploads them to BrowserStack App Live, and returns the `bs://...`
app id(s) in the SDK workflow summary.
After a successful upload, `github-actions[bot]` creates or updates one PR
comment with the latest build details (only the platform(s) actually
built) and the rebuild instructions.

Naming the commit is what binds the approval to a revision. Because a comment
event carries no head commit, the workflow has to read the head when it runs,
which is not when the comment was posted — so without the sha, a push landing
in between would inherit the approval and send an unreviewed revision into a
build that holds the automation repository's credentials. With the sha, a
moved head refuses the build and the workflow log names the sha to re-issue.
Three notes on the exact wording accepted:

- The sha has to be all 40 characters. An abbreviation could only be compared
  as a prefix, and a 7-character prefix is 28 bits — grinding a second commit
  that shares it is ordinary vanity-hash work, and the author can pre-compute
  it against their own commit's prefix before the approval is even posted. So
  abbreviations are refused rather than resolved.
- The bare form of each command (no sha) is accepted when the PR author is
  themselves an approved collaborator on
  `platform-sdk-reactnative-expo_automation`, since winning that race would
  grant them nothing they cannot already do directly.
- Surrounding whitespace is ignored, and anything else starting with
  `/app-live` — a typo like `/app-live-widnows`, or a command with trailing
  prose — is refused with a notice in the workflow log. It never falls back to
  building both platforms.

Builds are numbered per PR: the key is the branch's ticket key plus the PR
number, incrementing for each upload, for example `rn-YPE-3011-pr14-1`
and `rn-YPE-3011-pr14-2`. A sanitized 10-character branch label plus the
PR number is used when the branch has no ticket key, for example
`feature/rework-reader` becomes `rn-rework-rea-pr14-1`. The exact source
SHA is recorded separately in the workflow summary. The numbering is
shared across `/app-live`, `/app-live-ios`, and `/app-live-android` — it
isn't tracked per platform.

This initial bridge produces App Live builds only. It does not run the Hinqa
corpus or upload to App Automate. Ported from the same bridge in
`platform-sdk-swift` (YPE-3011); when one changes, check the other. Unlike
the Swift/Kotlin bridges, the initial PR-open build always builds **both**
platforms — the automation workflow requires a `platform` input and runs
two jobs (android, ios) per dispatch — and only the explicit rebuild
comments can narrow that to one.

## Useful Commands

From the repo root:

```bash
pnpm build          # turbo build
pnpm typecheck      # turbo typecheck
pnpm test           # turbo test
pnpm lint           # oxlint (type-aware TypeScript, Expo DOM, i18n, anti-slop)
pnpm lint:fix       # oxlint --fix
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
- **Metro**: keep `apps/example/metro.config.js` minimal with `getDefaultConfig(__dirname)` only. Expo SDK 52+ handles monorepo support. `apps/example/index.js` re-exports `expo-router/entry` — required for Metro monorepo resolution; do not inline the entry.
- **Distribution**: packages publish a compiled `build/` output via `expo-module-scripts` (`expo-module build`). Locally, Metro resolves TypeScript from source (`main` → `src/`); `publishConfig` swaps to `build/` at publish time. `tsc` preserves `'use dom'` and Expo processes it from compiled files. See [ADR 0011](./docs/adr/0011-compiled-distribution.md).
- **Releases**: this repo uses [Changesets](https://github.com/changesets/changesets) — run `pnpm changeset` on any PR that should ship to npm. See [PUBLISHING.md](./PUBLISHING.md) for the full flow and [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md) for RN-specific failure modes (peer-dep skew, `workspace:*` rewrite).
- **Native UI localization**: user-visible strings in `packages/ui/src/native/**` must use `useSdkTranslation()` and keys in `en.json` — see [docs/contributing/native-i18n.md](./docs/contributing/native-i18n.md).

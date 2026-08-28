# YouVersion Platform React Native Expo SDK

Wraps `@youversion/platform-react-ui` as Expo DOM components for React Native. Two packages: `@youversion/platform-react-native-expo-ui` and `@youversion/platform-react-native-expo-core`.

Keep this file brief. Put task-specific guidance behind a pointer.

Setup, Metro, native rebuild: `CONTRIBUTING.md`.
Consumer API: `README.md`.

## Gotchas

- **Worktree.** `pnpm install` at the worktree root first — iOS pods resolve via `:path:` into that worktree's `node_modules`. Copy `apps/example/.env`.
- **Metro cache.** Shared at `$TMPDIR/metro-cache`. A DOM bundling error that names another worktree: `cd apps/example && pnpm exec expo start --dev-client -c`.
- **Android `localStorage`.** Keep `ensureDomLocalStorage()`. `@expo/dom-webview` leaves `localStorage` null; the Web SDK throws and the component paints blank.
- **Fonts.** Brand fonts are SDK-owned via the Fonts API inside `YouVersionProvider`. After adding the `expo-font` peer, rebuild the dev client.
- **Tests.** Layers 1 (pure) and 3 (native). Do not mount `'use dom'` in RNTL — swap DOM / NativeSheet / sibling sheets through `component-impls` and assert the bridge with `latestDomProps`. Steer hooks through `hookOverrides`. Do not `jest.mock` app modules. `jest.setup.js` may shim native runtimes that cannot load in Jest.
- **Lint.** `pnpm lint` is type-aware oxlint (Expo DOM, native i18n, anti-slop). Do not suppress anti-slop rules. How to run: `CONTRIBUTING.md`.

## Guardrails

- Mount Web SDK components only inside an Expo DOM wrapper, never in React Native.

## Supply-Chain Protection

- Lift the cooldown with `pnpm install --config.minimumReleaseAge=0`. `--force` does not. A lockfile that resolved a too-new version reds CI until that version ages — lockfile verification runs on `--frozen-lockfile` too.
- pnpm 11 blocks postinstall unless listed in `allowBuilds`. Prefer `false` for packages that ship prebuilt binaries (`unrs-resolver`).
- After `expo install --fix`, re-pin the `~` ranges it wrote. Published `dependencies` / `devDependencies` stay exact; `peerDependencies` stay ranges.
- Third-party version bumps: pick a release ≥3 days old. `@youversion/*` is exempt.

## Domain

Planning or domain language: `CONTEXT.md` and `docs/adr/`. Grill the plan with [grill-with-docs](https://www.skills.sh/mattpocock/skills/grill-with-docs).

## Auth

Auth, grants, or data exchange: `CONTEXT.md` and ADRs [0014](docs/adr/0014-cached-grant-is-a-hint.md), [0015](docs/adr/0015-data-exchange-return-scheme.md).

## Highlights

Highlights, queue, drain, or permission flow: `CONTEXT.md` and ADRs [0013](docs/adr/0013-native-highlights-optimistic-layer.md), [0016](docs/adr/0016-highlight-permission-flow.md), [0017](docs/adr/0017-native-verse-action-sheet.md), [0018](docs/adr/0018-highlight-write-queue.md).

## Sheets

NativeSheet, pickers, or verse actions: ADRs [0005](docs/adr/0005-dom-owned-language-panel-in-version-picker.md), [0006](docs/adr/0006-inactive-sheet-inertness.md), [0010](docs/adr/0010-dom-keyboard-dismissal-on-sheet-close.md), [0017](docs/adr/0017-native-verse-action-sheet.md).

## Localization

Native copy or locale keys: `docs/contributing/native-i18n.md`.

## Distribution

Package entry, `publishConfig`, or tsconfig split: [ADR 0011](docs/adr/0011-compiled-distribution.md). `react-dom` stays a peer — **Dependency Boundary** in `CONTEXT.md`.

## Release

Changeset or publish: `PUBLISHING.md`. RN publish failure: `RELEASE-RUNBOOK.md`.

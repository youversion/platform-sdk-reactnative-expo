---
Status: accepted — supersedes ADR 0002
---

# Compiled distribution for publishing

We publish the packages as a compiled `build/` output (`tsc` → JS + `.d.ts`) rather than raw TypeScript source. This supersedes [ADR 0002](0002-source-only-distribution.md), whose premise — that compiling strips the `'use dom'` directive and makes Expo DOM Components non-functional — is empirically false.

## Why 0002 was wrong

0002 assumed a build pipeline could not ship working Expo DOM Components. Verified otherwise:

- **`tsc` preserves `'use dom'`.** A clean build of `packages/ui` keeps `'use dom';` as line 1 of every compiled DOM module in `build/` (confirmed in the packed tarball). TypeScript does not strip leading string-literal directives (same as `'use client'`).
- **The Expo plugin detects the directive in compiled `node_modules` JS.** `babel-preset-expo`'s `use-dom-directive-plugin` keys off the parsed Program directive (extension-agnostic) and explicitly handles DOM components inside `node_modules`. The transform runs in the consumer's Metro build over the installed `build/*.js`, exactly as it would over source.

## How we build

The build tool is [`expo-module-scripts`](https://www.npmjs.com/package/expo-module-scripts) (`expo-module build`), the same tooling Expo uses for its own modules, for ecosystem alignment. Under the hood it is plain `tsc`, so directive preservation is identical to a hand-rolled `tsc` invocation.

- Each package's `tsconfig.json` is the build config: it `extends "expo-module-scripts/tsconfig.base"` and sets `rootDir: src`, `outDir: build`, excluding tests. `expo-module build` discovers this config (no `-p` flag). The UI package additionally sets `resolveJsonModule: true` — the base does not, and `src/i18n` imports `en.json`.
- The base config is stricter than the repo root tsconfig (`verbatimModuleSyntax`, `isolatedModules`, `noUncheckedIndexedAccess`, `noUnusedLocals`). Source was adjusted to satisfy it (type-only imports, indexed-access guards).
- `tsconfig.test.json` re-includes tests for `pnpm typecheck` and editor coverage (the build config excludes them so they are not emitted).
- **Watch gotcha:** `expo-module build` appends `--watch` when stdout is a TTY and neither `CI` nor `EXPO_NONINTERACTIVE` is set. CI and `turbo` (piped stdout) get a one-shot build; running `pnpm build` directly inside a package in an interactive shell starts a watcher.

## What we ship

- Top-level `main` / `types` stay `src/index.ts`, so in-repo Metro resolves TypeScript directly — no build step for local dev or the example app (`workspace:*`).
- `publishConfig` swaps `main` / `types` to `build/`, and `files: ["build"]` keeps source out of the tarball, so the published package ships compiled JS plus real `.d.ts`.
- Releases MUST go through `pnpm changeset publish` (the configured pipeline). `pnpm publish` applies the `publishConfig` field overrides; raw `npm publish` does not — `main` would stay `src/index.ts` while `files: ["build"]` excludes `src/`, so the tarball would be broken (entry point missing or unable to resolve its imports), not a clean source ship. See [PUBLISHING.md](../../PUBLISHING.md).

## Consequences

- Gains real `.d.ts` and removes 0002's `moduleResolution: bundler`-only constraint for consumers.
- Adds a build step on the publish path only (`turbo build` before `changeset publish`); local dev stays build-free.
- Adds `expo-module-scripts` (and its dependency tree) as a dev dependency to both packages.
- Locks the publish tool to pnpm. Raw `npm publish` is unsupported.
- The publish mechanism is verified via `pnpm pack` (tarball ships `build/`, excludes `src/`, preserves `'use dom'`), but not yet validated end-to-end with an installed tarball rendering on device. PUBLISHING.md gates the first publish on that check.

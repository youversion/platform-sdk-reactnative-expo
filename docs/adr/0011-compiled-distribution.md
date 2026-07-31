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

## Sealed import surface

Both packages declare a root-only `exports` map. The only entry points are `"."` (the package root) and `"./package.json"`; there are no subpath entries, so the supported way to consume either package is `import … from '@youversion/platform-react-native-expo-ui'` / `-core`, and a deep import like `@youversion/platform-react-native-expo-ui/build/dom/bible-card` is not part of the public API.

Why seal it:

- **Raw DOM components are not package API.** Only the barrel (`src/index.ts` → `build/index.js`) is public. DOM component files exist purely as the WebView-backed implementation of the native wrappers.
- **Deep imports would freeze the internal file layout.** Without `exports`, `build/dom/*`, `build/native/*`, and `build/lib/*` are all reachable, so any consumer importing them turns our directory structure into a compatibility contract. The map keeps refactors of internal layout non-breaking.

### Enforcement boundary (important)

The map is enforced strictly by Node's own resolver and by TypeScript, and loosely by Metro:

- **Node resolution** hard-errors on an unmatched subpath: `require.resolve('@youversion/platform-react-native-expo-ui/build/dom/bible-card')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. Same for any strict `exports`-aware bundler (webpack, Vite, esbuild, Rollup with default settings).
- **TypeScript** (`moduleResolution` `node16`/`nodenext`/`bundler`) refuses to resolve types for a deep path, so a consumer writing a deep import gets a compile error in-editor and in CI typecheck. This is the primary developer-facing guardrail — the import is rejected before it can ship.
- **Metro does _not_ enforce it.** Even with `resolver.unstable_enablePackageExports: true` (the Expo SDK 56 default), Metro falls back to plain filesystem resolution for a subpath that the `exports` map does not match, instead of hard-erroring the way Node does. Verified: a fresh SDK 56 app installing the packed tarballs bundles a deep import into `build/dom/*` without error. So at the RN bundler level a determined consumer can still reach internal files at runtime; the `exports` map does not make that physically impossible, it makes it unsupported and type-rejected. If we ever need Metro-level enforcement we would have to remove the files from the tarball or split internals into a separate unpublished package — out of scope here.

Net: the seal reliably stops deep imports from being _written_ (TypeScript) and from resolving under Node and standard web bundlers; it documents internal files as non-API; it does not physically block Metro's loose runtime fallback.

Dev vs. publish, same swap as `main`/`types`:

- Top-level `exports["."]` points at `./src/index.ts` (both `types` and `default`), so in-repo Metro and `tsc` resolve TypeScript source directly — no build step for local dev or the example app.
- `publishConfig.exports` overrides `"."` to `types: ./build/index.d.ts`, `default: ./build/index.js`, applied by `pnpm publish` exactly like the `main`/`types` overrides. `"./package.json"` stays exposed in both.

Timing: loosening an `exports` map later (adding subpaths) is additive and non-breaking, while tightening one later (removing subpaths consumers already import) is breaking. Sealing before the first real release (0.9.1) means the surface starts minimal and can only widen, never narrow, so no consumer ever depends on an internal path we later want to remove.

## Consequences

- Gains real `.d.ts` and removes 0002's `moduleResolution: bundler`-only constraint for consumers.
- Adds a build step on the publish path only (`turbo build` before `changeset publish`); local dev stays build-free.
- Adds `expo-module-scripts` (and its dependency tree) as a dev dependency to both packages.
- Locks the publish tool to pnpm. Raw `npm publish` is unsupported.
- The publish mechanism is verified via `pnpm pack` (tarball ships `build/`, excludes `src/`, preserves `'use dom'`), but not yet validated end-to-end with an installed tarball rendering on device. PUBLISHING.md gates the first publish on that check.

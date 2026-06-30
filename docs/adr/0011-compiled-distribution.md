---
Status: accepted — supersedes ADR 0002
---

# Compiled distribution for publishing

We publish the packages as a compiled `dist/` build (`tsc` → JS + `.d.ts`) rather than raw TypeScript source. This supersedes [ADR 0002](0002-source-only-distribution.md), whose premise — that compiling strips the `'use dom'` directive and makes Expo DOM Components non-functional — is empirically false.

## Why 0002 was wrong

0002 assumed a build pipeline could not ship working Expo DOM Components. Verified otherwise:

- **`tsc` preserves `'use dom'`.** A clean `tsc -p tsconfig.build.json` of `packages/ui` keeps `'use dom';` as line 1 of every compiled DOM module in `dist/`. TypeScript does not strip leading string-literal directives (same as `'use client'`).
- **The Expo plugin detects the directive in compiled `node_modules` JS.** `babel-preset-expo`'s `use-dom-directive-plugin` keys off the parsed Program directive (extension-agnostic) and explicitly handles DOM components inside `node_modules`. The transform runs in the consumer's Metro build over the installed `dist/*.js`, exactly as it would over source.

## What we ship

- Top-level `main` / `types` stay `src/index.ts`, so in-repo Metro resolves TypeScript directly — no build step for local dev or the example app (`workspace:*`).
- `publishConfig` swaps `main` / `types` to `dist/`, and `files: ["dist"]` keeps source out of the tarball, so the published package ships compiled JS plus real `.d.ts`.
- Releases MUST go through `pnpm changeset publish` (the configured pipeline). `pnpm publish` applies the `publishConfig` field overrides; raw `npm publish` does not — it would ship `main → src/index.ts` and leak source. See [PUBLISHING.md](../../PUBLISHING.md).

## Consequences

- Gains real `.d.ts` and removes 0002's `moduleResolution: bundler`-only constraint for consumers.
- Adds a build step on the publish path only (`turbo build` before `changeset publish`); local dev stays build-free.
- Locks the publish tool to pnpm. Raw `npm publish` is unsupported.
- The mechanism is verified, but not yet validated end-to-end with an installed tarball on device. PUBLISHING.md gates the first publish on that check.

---
Status: accepted
---

# Stamp the SDK version into the published build; keep a `Dev` sentinel in source

Every API call made from inside a DOM component carries an `x-yvp-sdk` header (`ReactNativeSDK=<version>`), stamped by our DOM-side `YouVersionProvider` wrapper (`lib/web-yv-provider.ts`) via `getSdkHeaders()` in `lib/sdk-version.ts`. YouVersion's data lake uses this header to tell **internal dev-time traffic** apart from **published-SDK (partner) traffic**.

`SDK_VERSION` is `'Dev'` in source. On publish, `scripts/stamp-sdk-version.cjs` — wired as the last step of the UI package `prepublishOnly` (`expo-module prepublishOnly && node scripts/stamp-sdk-version.cjs`) — rewrites the `'Dev'` literal in the **compiled** `build/lib/sdk-version.js` to the real `package.json` version. Source is never touched.

## Why not just what the header comment used to claim

The prior comment asserted "the release workflow rewrites the value below before publish." No such step existed anywhere — not in `release.yml`, not in any script, not in `changeset version` (which only edits `package.json` + changelogs). So every published tarball shipped `ReactNativeSDK=Dev`, making partner and internal traffic **indistinguishable** — the exact thing the header exists to separate. This ADR records the mechanism that actually delivers it.

## The requirement forces the mechanism

We want two distinct signals from one source file:

- runs from **source** (dev: `main: src/index.ts`, Metro) → report `Dev`
- runs from the **published** artifact (`publishConfig.main: build/index.js`) → report the real version

Identical source must behave differently in `src` vs `build`. Only three mechanisms can do that:

1. **Runtime detection** (`__DEV__`, path sniffing) — rejected. `__DEV__` reflects the _consumer app's_ build mode, not whether the SDK came from npm (a partner's debug build would wrongly report `Dev`), and it is unreliable inside the DOM/WebView context.
2. **Bundler define/replace** (`__VERSION__` swapped at compile) — the usual library approach, but it needs a bundler. Our build is `tsc` via `expo-module build` ([ADR 0011](0011-compiled-distribution.md)); adopting esbuild/rollup solely for this is disproportionate.
3. **Post-build stamp** — inject the version into the compiled artifact after `tsc`, before pack. Fits the existing toolchain. Chosen.

## Why not import `package.json` (Web SDK parity)

The sibling `@youversion/platform-core` does `import pkg from '../package.json'; export const SDK_VERSION = pkg.version`. That is simpler, but it has **no dev sentinel** — a Web SDK dev build and a partner build both report the same version, so it does not actually separate dev from partner traffic. It also relies on the bundler inlining the JSON import, which our `tsc` build does not do. Importing `package.json` would report the in-progress version in dev too, defeating the internal-vs-partner split that is the whole reason this header matters for the RN SDK. We deliberately diverge from the Web SDK here.

## Mechanics

- **One `.cjs` file** (`scripts/stamp-sdk-version.cjs`) holds both the pure transform and the file IO. The IO runs only under `require.main === module`. `packages/ui` has no `"type": "module"` yet emits ESM-syntax `build/` output, so a Node script cannot cleanly `import` the compiled file; a self-contained CJS script side-steps the module-system mismatch and runs natively at publish with no build step of its own.
- **Wired into `prepublishOnly`, not `release.yml`.** Folding it into the build script gives deterministic build-then-stamp ordering (immune to npm/pnpm lifecycle-order quirks) and keeps the mechanism visible from `package.json` rather than buried in a workflow. A CI-only step would recreate the original failure mode: behavior hidden in the workflow, invisible from the source file.
- **`pnpm pack` does not stamp.** `prepublishOnly` runs on `pnpm publish` only — `pnpm pack` runs neither the build nor the stamp, so a packed tarball reports `'Dev'` (or ships empty, if `build/` is absent). To reproduce a publish-identical tarball off-CI, run the publish steps by hand:

  ```bash
  pnpm build && node scripts/stamp-sdk-version.cjs && pnpm pack
  ```

  Do not "fix" this by moving the stamp to `prepack`/`prepare`: those run on `pnpm pack` and local installs, which would stamp dev builds and destroy the `'Dev'`-vs-published split this ADR exists to create.

- **Fail-hard guards.** The transform throws unless it finds exactly one `SDK_VERSION = 'Dev'` anchor, and asserts post-stamp that the version is present and `'Dev'` is gone. A refactor that moves or duplicates the literal breaks the publish rather than silently leaking `Dev`. It also rejects a version containing a quote, backslash, or newline. Covered by `src/lib/__tests__/sdk-version-stamp.test.ts`.
- `build/` is gitignored, so stamping never dirties the working tree.

## Consequences

- Published packages report their real version in `x-yvp-sdk`; dev/source builds report `Dev`. The data lake can cleanly filter internal traffic **and** see which version partners run.
- The publish path gains a small, tested script. Diverges intentionally from the Web SDK's `package.json`-import approach.
- The `'Dev'` sentinel line is load-bearing: it must stay a lone single-quoted `'Dev'` assignment, or the publish fails loudly. Comments must not reproduce the full `SDK_VERSION = 'Dev'` text (it would inflate the anchor count).
- Only `packages/ui` is affected; `packages/core` has no such header.

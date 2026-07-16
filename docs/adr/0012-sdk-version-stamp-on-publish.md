---
Status: accepted
---

# Suffix the `x-yvp-sdk` version with `-dev` in source; stamp the publish channel into the compiled build

Every API call made from inside a DOM component carries an `x-yvp-sdk` header (`ReactNativeSDK=<version>`), stamped by our DOM-side `YouVersionProvider` wrapper (`lib/web-yv-provider.ts`) via `getSdkHeaders()` in `lib/sdk-version.ts`. YouVersion's data lake uses this header to tell **internal dev-time traffic** apart from **published-SDK (partner) traffic**.

`package.json` is the single source of the version. `lib/sdk-version.ts` varies only a suffix by build channel:

- source / dev / test builds → `ReactNativeSDK={version}-dev`
- published builds → `ReactNativeSDK={version}`

The telemetry rule is `value.endsWith('-dev')`, identical to the Web SDK ([platform-sdk-react ADR 0002](https://github.com/youversion/platform-sdk-react/blob/main/docs/adr/0002-sdk-version-dev-suffix-on-build.md)).

On publish, `scripts/stamp-sdk-version.cjs` — wired as the last step of the UI package `prepublishOnly` (`expo-module prepublishOnly && node scripts/stamp-sdk-version.cjs`) — flips `IS_PUBLISH_BUILD` from `false` to `true` in the **compiled** `build/lib/sdk-version.js`. Source is never touched.

## Why the header was broken

The prior comment asserted "the release workflow rewrites the value below before publish." No such step existed anywhere — not in `release.yml`, not in any script, not in `changeset version` (which only edits `package.json` + changelogs). So every published tarball shipped `ReactNativeSDK=Dev`, making partner and internal traffic **indistinguishable** — the exact thing the header exists to separate.

## Why `{version}-dev` rather than a bare `Dev` sentinel

An earlier revision of this ADR hardcoded `SDK_VERSION = 'Dev'` in source and had the stamp rewrite that literal to the real version. That worked, but it threw away information: bare `Dev` tells you traffic is internal without telling you _which release_ it came from, and it gave the two SDKs different telemetry formats for the same requirement.

`-dev` is a semver prerelease tag, so `0.9.0-dev` keeps the version line in dev traffic and makes one filter (`endsWith('-dev')`) work across both SDKs. Format parity was the deciding factor; this is not a behavior bug fix.

## Why importing `package.json` is fine here (reversing an earlier decision)

The earlier revision rejected `import pkg from '../../package.json'` on two grounds. Both have since resolved:

1. **"It has no dev sentinel — dev and partner builds report the same version."** The `-dev` suffix _is_ the sentinel. `{version}-dev` vs `{version}` separates the two channels cleanly, which is what made the import viable while keeping the split. This objection dissolves.
2. **"`tsc` doesn't inline the JSON, so the import must resolve across the `src/` → `build/lib/` layout shift."** Measured, and it is a non-issue: `src/` and `build/` are siblings at equal depth, so `../../package.json` resolves to `packages/ui/package.json` from **both** `src/lib/` and `build/lib/` — the same path. `tsc` emits with no `rootDir` violation, does not copy `package.json` into `build/`, and leaves the import verbatim. npm always includes `package.json` in the tarball, so it is present at runtime for consumers.

So the version import stays live in the published artifact, and only the channel flag is stamped.

## The requirement forces the mechanism

Identical source must behave differently in `src` vs `build`. Only three mechanisms can do that:

1. **Runtime detection** (`__DEV__`, path sniffing) — rejected. `__DEV__` reflects the _consumer app's_ build mode, not whether the SDK came from npm (a partner's debug build would wrongly report `-dev`), and it is unreliable inside the DOM/WebView context.
2. **Bundler define/replace** — what the Web SDK uses (`tsup`'s `env` option folds `process.env.YVP_PUBLISH_BUILD` to a constant). Needs a bundler. Our build is `tsc` via `expo-module build` ([ADR 0011](0011-compiled-distribution.md)); adopting esbuild/rollup solely for this is disproportionate.
3. **Post-build stamp** — flip the flag in the compiled artifact after `tsc`, before pack. Fits the existing toolchain. Chosen.

We land on the same **outcome** as the Web SDK via a different mechanism, because the tool differs. The requirement is the dev/partner split and its format, not the stamping technique.

## Mechanics

- **One `.cjs` file** (`scripts/stamp-sdk-version.cjs`) holds both the pure transform and the file IO. The IO runs only under `require.main === module`. `packages/ui` has no `"type": "module"` yet emits ESM-syntax `build/` output, so a Node script cannot cleanly `import` the compiled file; a self-contained CJS script side-steps the module-system mismatch and runs natively at publish with no build step of its own.
- **Wired into `prepublishOnly`, not `release.yml`.** Folding it into the build script gives deterministic build-then-stamp ordering (immune to npm/pnpm lifecycle-order quirks) and keeps the mechanism visible from `package.json` rather than buried in a workflow. A CI-only step would recreate the original failure mode: behavior hidden in the workflow, invisible from the source file.
- **The guard asserts the positive stamp, and fails closed.** The transform throws unless it finds exactly one `IS_PUBLISH_BUILD = false` anchor, then asserts post-stamp that `= true` is present and `= false` is gone. It deliberately does **not** check that `-dev` is absent: the compiled ternary keeps the suffix in its dead else branch in _every_ build, published or not, so a `-dev` match would false-positive on every artifact. Checking only that `= false` disappeared would fail **open** — if tooling ever folded or minified the constant away, neither literal would survive and a dev build would sail through. Requiring the stamp means a build whose channel cannot be confirmed aborts the publish.
- **The anchor is checked against real `tsc` output in CI.** `SENTINEL` matches _compiled_ text, so it can drift away from source with every fixture-based unit test still green — and the first sign would be `changeset publish` throwing mid-release, after `packages/core` may already be on npm (a partial release). `src/lib/__tests__/sdk-version-stamp.test.ts` therefore transpiles the real `src/lib/sdk-version.ts` and asserts the anchor survives, moving that failure to the PR that causes it.
- **`pnpm pack` does not stamp.** `prepublishOnly` runs on `pnpm publish` only — `pnpm pack` runs neither the build nor the stamp, so a packed tarball reports `-dev` (or ships empty, if `build/` is absent). To reproduce a publish-identical tarball off-CI, run the publish steps by hand:

  ```bash
  pnpm build && node scripts/stamp-sdk-version.cjs && pnpm pack
  ```

  Do not "fix" this by moving the stamp to `prepack`/`prepare`: those run on `pnpm pack` and local installs, which would stamp dev builds and destroy the split this ADR exists to create.

- `build/` is gitignored, so stamping never dirties the working tree.

## Consequences

- Published packages report `ReactNativeSDK={version}`; dev/source builds report `ReactNativeSDK={version}-dev`. The data lake filters internal traffic with `endsWith('-dev')` — one rule for both SDKs — and still sees which version dev traffic came from.
- The `IS_PUBLISH_BUILD = false` line is load-bearing: it must stay a lone `= false` assignment, or the publish fails loudly. Comments must not reproduce that exact text (it would inflate the anchor count).
- Metro bundles `packages/ui/package.json` into consumer apps to resolve `pkg.version` (a few KB of already-public metadata, since Metro does not tree-shake by default). Accepted as the cost of keeping `package.json` the single version source.
- The publish path gains a small, tested script.
- Only `packages/ui` is affected; `packages/core` has no such header.

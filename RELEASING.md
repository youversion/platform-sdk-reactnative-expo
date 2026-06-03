# Release Process

Releases on this repo are **manually triggered with an explicit version input**. A human types the version they want to publish into the Actions UI (or `gh workflow run`), the workflow validates it, and the release ships across GitHub (tag + release) and npm (both workspace packages). There is no auto-release on merges to `main`.

> **For almost every partial failure, re-dispatch `release.yml` with the same version.** The orchestrator detects the existing tag on origin, picks up where the previous run left off, and skips already-completed phases. See [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md) for the full failure-mode catalogue.

## Overview

The release pipeline does not use `semantic-release` as an orchestrator. We use two pieces of it as libraries:

- [`@semantic-release/commit-analyzer`](https://github.com/semantic-release/commit-analyzer) — invoked by `scripts/preview-release.mjs` to compute what version the commits *would* suggest (shown in the PR's Commit Lint comment and in the release workflow's job summary for audit).
- [`@semantic-release/release-notes-generator`](https://github.com/semantic-release/release-notes-generator) — invoked by `scripts/generate-release-notes.mjs` to render the CHANGELOG entry and GitHub release body from commits since the last tag.

Everything else (validation, version stamping, package.json updates, build, commit, tag, push, GitHub release creation, npm publish, Dev-restore) is in `scripts/release.sh`, which the release workflow calls directly.

This split exists because `semantic-release`'s lifecycle tightly couples computation to execution. There is no hook to override its calculated version — the only way to ship a version that differs from what the analyzer computes is to commit-message-engineer history, which is brittle, slow, and unreviewable. By making the version an explicit workflow input we get one-click overrides, a side-by-side audit log of "calculator said X, human chose Y," and no history rewrites.

## Publishable packages

Two workspace packages publish on every release, in dependency order:

1. **`@youversion/platform-react-native-expo-core`** — `packages/core/`
2. **`@youversion/platform-react-native-expo-ui`** — `packages/ui/` — depends on `…-core` via `workspace:*`

Both ship at the same version on each release. `pnpm publish` rewrites the `workspace:*` reference in the `ui` package's tarball to the actual published `…-core` version, so end consumers see a normal version-pinned dependency.

## How it works

1. **Develop on a branch with conventional commit subjects.** The `Commit Lint` workflow validates every PR and previews the version the analyzer would compute.
2. **Merge PRs to `main`.** Nothing publishes. `main` just accumulates work.
3. **Decide on a version.** The most recent merged PR's Commit Lint comment shows the analyzer-computed value, which is the suggested next version. You can accept that or override.
4. **Dispatch the Release workflow** from the Actions tab → `Release` → "Run workflow", or via CLI:
   ```bash
   gh workflow run release.yml -f version=0.1.0
   ```
   To validate the workflow end-to-end on a feature branch without publishing or pushing, also pass `-f dry-run=true`. To ship under a non-default dist-tag (e.g. for a pre-release channel), pass `-f dist-tag=next`.
5. **The workflow runs `scripts/release.sh`**, which:
   - Validates the input is valid semver and strictly greater than the current tag (unless we're resuming a prior partial run — see [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md)).
   - Logs the calculator's computed value alongside the chosen value in the job summary.
   - Generates release notes from commits since the last tag.
   - Prepends the new entry to `CHANGELOG.md`.
   - Stamps both `package.json#version` files and `packages/core/src/version.ts` to the chosen version.
   - Builds both packages (`pnpm exec turbo run build`).
   - Commits everything as `chore(release): <version> [skip ci]` (commit **X**), with the release notes embedded as the commit body.
   - Tags **X** with the version and pushes both to `main`.
   - Creates a GitHub release with the generated notes.
   - Publishes both packages to npm in dependency order (`core` → `ui`) with bounded retry, OIDC provenance attestation, and per-package idempotency.
   - Creates a follow-up commit **Y** that restores `SDK_VERSION` to `"Dev"` in `packages/core/src/version.ts` on `main`, so dev/CI builds don't report a stale released version. The tag stays at **X** (which is reachable from `main` via Y → X).
   - Both `package.json#version` fields stay at the released version on `main`. npm consumers fetch from the registry, not from `main`, so leaving the manifests at the released version is a no-op for consumers and avoids surprising local pnpm tooling.

## Required GitHub configuration

### GitHub Secrets

#### 1. `NPM_TOKEN` (fallback auth)

An npm automation token with publish rights for `@youversion/*`. Used by `release.yml` and `manual-npm-publish.yml` as the fallback when OIDC isn't available.

To create one:

1. Log in to npm as a user with publish rights on the `@youversion` scope.
2. Visit https://www.npmjs.com/settings/<your-username>/tokens.
3. Generate an **Automation** token (not a Publish or Read-only token). Automation tokens bypass 2FA on publish — required for CI.
4. Add it to the repo at `https://github.com/youversion/platform-sdk-reactnative-expo/settings/secrets/actions` as `NPM_TOKEN`.

> **Why an Automation token specifically:** Publish tokens require 2FA on every publish call. CI cannot satisfy a 2FA prompt. The runbook covers the OTP error class — if you see `EOTP` / "need a one-time password" in publish logs, the token is the wrong kind.

#### 2. (Recommended) OIDC + npm provenance

OIDC removes the long-lived secret from the loop and produces a signed attestation linking the published tarball to this exact CI run. Set this up on the npm side when you can:

1. On the npm package page for each of `@youversion/platform-react-native-expo-core` and `@youversion/platform-react-native-expo-ui`, configure a **trusted publisher** policy for this repo / workflow.
2. The `release.yml` workflow already declares `permissions: id-token: write` and sets `PROVENANCE: "1"`, so `pnpm publish --provenance` runs automatically once npm trusts the workflow.

If OIDC isn't configured yet, the workflow falls back to `NPM_TOKEN` and provenance attestation simply isn't generated for that release. The publish itself still succeeds.

### Branch protection

If `main` is configured with a ruleset that requires PRs, add an entry to its **bypass list** so the release workflow's commits **X** and **Y** can land directly on `main`:

1. Go to `https://github.com/youversion/platform-sdk-reactnative-expo/settings/rules`.
2. Edit the ruleset for `main` (or create one if needed).
3. Under "Bypass list", add `github-actions[bot]` (or whichever identity the release workflow runs as).
4. Under "Require status checks", add at minimum: `Lint`, `Typecheck`, `Build`, `Test`, `Commit Lint`. These are the gates that prove PRs are mergeable; release.yml re-runs them as a `test` job before shipping.

The workflow uses the default `GITHUB_TOKEN` to push commits and tags — no deploy key required as long as the bypass list above is configured. If a future ruleset change disallows even bypassed direct pushes, swap to a personal access token or a deploy key.

## Local testing

### Preview the version the analyzer would suggest

```bash
node scripts/preview-release.mjs \
  --base "$(git describe --tags --abbrev=0)" \
  --head HEAD
```

Outputs JSON: `{"current": "0.1.0", "next": "0.1.1", "release_type": "patch", ...}`. The same logic the `Commit Lint` workflow uses on every PR.

### Generate release notes for a hypothetical version

```bash
node scripts/generate-release-notes.mjs \
  --base "$(git describe --tags --abbrev=0)" \
  --head HEAD \
  --version 0.1.1
```

Prints the markdown that would be prepended to `CHANGELOG.md` and used as the GitHub release body.

### Dry-run the full release end-to-end

```bash
VERSION=0.1.1 DRY_RUN=1 bash scripts/release.sh
```

Validates the version, generates notes, updates `CHANGELOG.md` and both package.json files, stamps `version.ts`, builds, commits, tags — then stops without pushing or publishing.

Clean up after a dry-run:

```bash
git reset --hard HEAD^
git tag -d <version>
git restore .
rm -f notes.md
```

### Test commitlint

```bash
# Lint every commit on your branch that isn't on main
npx commitlint --from=origin/main --to=HEAD --verbose

# Pipe a single message to test rule changes
echo "feat: add new feature" | npx commitlint
echo "invalid message" | npx commitlint   # should fail
echo "chore(release): 1.2.3 [skip ci]" | npx commitlint  # should pass (ignored)
```

## Version synchronization

Both workspace packages are kept in sync via `scripts/stamp-version.sh`:

- `packages/core/package.json` (version field)
- `packages/ui/package.json` (version field)
- `packages/core/src/version.ts` (SDK_VERSION constant, used by runtime telemetry)

`pnpm publish` resolves `workspace:*` references at publish time, so the published `…-ui` tarball carries the actual released `…-core` version as a normal dependency.

## Publishing order

Packages are published in dependency order by `scripts/publish-npm.sh`:

1. **`@youversion/platform-react-native-expo-core`** (no workspace dependencies)
2. **`@youversion/platform-react-native-expo-ui`** (depends on core)

Each publish is gated by `npm view <pkg>@<version>` to detect already-published versions and skip them. The classifier is documented in the script header — transient signatures retry; hard signatures abort.

## Troubleshooting

### "The Commit Lint preview shows a major bump on a fix-only PR"

`conventional-commits-parser` treats `BREAKING CHANGE` at the start of any commit body line as a breaking-change footer, regardless of surrounding markdown or quotes. The most common cause: a long commit body wraps and a paragraph happens to start with that token. Reword the offending line on your branch.

The analyzer log in the PR comment's `<details>` block shows which commit triggered the classification.

### "Release is rejected with 'not strictly greater than current tag'"

`release.sh` refuses to ship a version less than or equal to the latest tag **unless** the tag already exists on origin (resume mode). If you genuinely need to re-tag, delete the old tag from origin first, then dispatch again. If you're trying to *recover* a partial release, just re-dispatch with the same version — that triggers resume mode automatically.

### "npm publish failed midway"

The script is idempotent via `npm view`. Re-dispatch with the same version; the already-published package will be skipped and the missing one retried. Full failure-mode catalogue in [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md).

### Other recovery scenarios

For anything not covered above, see [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md) — it enumerates every known partial-failure mode with state-check and recovery commands.

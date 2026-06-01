# Release Hardening Plan — YPE-2789

Engineering plan for hardening (and, as it turns out, *building*) the manual release procedure for `@youversion/platform-react-native-expo`. Mirrors the pattern shipped in `platform-sdk-swift` under [YPE-2684](https://github.com/youversion/platform-sdk-swift), adapted for npm + pnpm + Expo.

This doc is the deliverable from the last AC item of YPE-2789. Implementation work follows the plan herein.

## Goal

A single human-dispatched workflow that ships a chosen semver to GitHub (tag + release) and npm (`@youversion/platform-react-native-expo`), recoverable from any partial failure by re-dispatching the **same version** — no manual git/npm cleanup.

## Current state (assessed)

The Swift SDK's parent ticket (YPE-2684) assumed an existing pipeline to harden. **This repo has no release pipeline at all.** Concretely:

- No `.github/workflows/release.yml` (only `ci.yml` — lint / typecheck / test).
- No `scripts/` directory. No `release.sh`, no `publish-*.sh`.
- No release tooling — no `semantic-release`, no `changesets`, no `.releaserc*`.
- No `NPM_TOKEN` or OIDC publish wiring in any workflow.
- No `commit-lint.yml` workflow; no `commitlint.config.js`.
- No `RELEASING.md` or `RELEASE-RUNBOOK.md`.
- The publishable package (`packages/ui/`) has `main: src/index.ts` — no build output, no `dist/`. The package has never been published; current version is `0.0.1`.
- Conventional-commit hygiene on `main` is good by convention but unenforced.

YPE-2789's real scope is therefore "**build the manual release pipeline AND ship it hardened from day one**." The upside of this larger scope is that hardening informs the initial design instead of being retrofitted onto a fragile pipeline.

## Source pattern reference (Swift YPE-2684)

We copy these concepts wholesale from Swift, adapted for the npm publish surface:

1. **Resume-on-re-dispatch.** `git ls-remote origin refs/tags/$VERSION` is the detection gesture. When the tag exists on origin we treat the dispatch as a resume — skip the strictly-greater-than-current-tag validation, regenerate notes from the tag range, jump to post-tag steps.
2. **"Overlay scripts/" on resume.** Before running post-tag work in resume mode, fetch the latest `scripts/` directory from `origin/main` and overlay it onto the detached tag checkout. Fixes to the retry/idempotency logic are applied on re-dispatch.
3. **Idempotent post-tag steps.** Every step downstream of the tag push gates on a pre-check:
   - Main push → `git merge-base --is-ancestor` X vs `origin/main` HEAD.
   - GitHub release → `gh release view "$VERSION"`.
   - Registry publish → registry-state query (Swift: `pod trunk info`; here: `npm view`).
   - Dev-restore → version sentinel in source + tag ancestry check.
4. **Bounded retry on registry publish.** Two attempts × 30s backoff. Classify errors:
   - **Transient (retry):** timeouts, 5xx, network resets, unreachable.
   - **Hard-fail (abort):** auth, validation, conflicting input.
   The retry lives in the publish script; the workflow dispatch is the outer human-retry loop.
5. **RELEASE-RUNBOOK.md.** A failure-mode catalogue with state-check + recovery for each scenario. For nearly every partial failure the recovery is "re-dispatch the same version"; the runbook explains when *that* isn't safe.
6. **Commit-lint range correction.** Use `origin/<base ref>..head.sha`, not `base.sha..head.sha`. Ignore `chore(release):` commits in commitlint config.

## npm-specific concerns (from the AC)

These are the npm/pnpm/Expo failure shapes that need first-class handling — they have no Swift analog:

| Concern | Handling |
|---|---|
| `npm publish` is hard-non-idempotent — re-publishing same version returns `EPUBLISHCONFLICT` | Pre-check with `npm view <pkg>@<version>` before publish. After publish, treat `EPUBLISHCONFLICT` as success-after-the-fact (the version is on the registry). |
| Auth via `NPM_TOKEN` vs OIDC + `--provenance` | Workflow supports both. Recommend OIDC (`id-token: write` + `--provenance`) as the primary path; `NPM_TOKEN` is documented as the fallback. Runbook covers both expired-token signatures. |
| Provenance attestation can fail independently of publish | Classified as transient; retried. Runbook documents it explicitly so an operator knows whether the package was published. |
| 2FA / OTP on user tokens breaks CI | Document explicitly: CI tokens must be `--auth-and-writes` automation tokens (no 2FA). Surface this in `RELEASING.md` + runbook. |
| dist-tags (`next` / `beta` / `latest`) | Resume mode preserves the originally-intended dist-tag — don't default to `latest` on resume. Plumbed as a workflow input or derived from a `--tag` flag passed at first dispatch. |

## Phased work breakdown

### Phase 1 — Build infrastructure (`packages/ui/`)

Adds a real build step so we have something to publish.

- **`packages/ui/tsconfig.build.json`** — emits to `packages/ui/dist/`. Declarations + JS.
- **`packages/ui/package.json`** — set `main: dist/index.js`, `types: dist/index.d.ts`, `files: ["dist"]`, add `"build": "tsc -p tsconfig.build.json"` script. Keep `version: 0.0.1` as the "Dev" baseline; release script overwrites it.
- **Turbo wiring** — add `build` task to `turbo.json` (or extend existing) so `turbo run build --filter @youversion/platform-react-native-expo` works.
- **Sanity gate** — Build verifies in CI on PRs (extends `ci.yml`).

### Phase 2 — Version-stamping

Equivalent of Swift's `SDKVersion.swift` "Dev" sentinel pattern.

- **`packages/ui/src/version.ts`** — exports `export const SDK_VERSION = "Dev";`. Surfaceable to consumers if any want it; the value is the trigger for our "is this a Dev or released build?" check.
- **`scripts/stamp-version.sh`** — writes the chosen version into both `packages/ui/package.json#version` and `packages/ui/src/version.ts`. Idempotent.
- **`scripts/restore-dev-sdk-on-main.sh`** — resets `version.ts` to `"Dev"` on main after a successful release. Skips if already at `"Dev"` and tag is reachable from HEAD.

### Phase 3 — Release scripts (`scripts/`)

Mirror the Swift script layout, adapted for npm.

- **`scripts/release.sh`** — orchestrator. Inputs: `VERSION`, `DRY_RUN`, `DIST_TAG` (default `latest`).
  - Validate input (semver, strictly > current tag *unless* resume).
  - Detect resume via `git ls-remote origin refs/tags/$VERSION`. If resume: checkout tag detached, overlay `scripts/` from `origin/main`, derive `$PREV_TAG`, regenerate notes.
  - If fresh: stamp version, build, generate notes, commit X (chore(release): $VERSION), tag, push X+tag.
  - Post-tag (idempotent in either path): GitHub release create, publish to npm, Dev-restore commit Y, push Y.
- **`scripts/publish-npm.sh`** — bounded retry + idempotency.
  - Pre-check via `npm view @youversion/platform-react-native-expo@$VERSION`. Skip publish if present.
  - 2 attempts × 30s backoff.
  - Classify stderr: transient signatures (`ETIMEDOUT`, `ECONNRESET`, `EAI_AGAIN`, `5\d\d`, `network`, `Could not resolve host`, provenance-attestation errors) → retry; hard signatures (`EAUTH`, `E401`, `EUNAUTHORIZED`, `EPRIVATE`, `E403`, `EINVALIDTAGNAME`, `EINVALIDPACKAGENAME`) → abort.
  - On non-zero exit: re-check via `npm view`. If the version is now present, treat as success-after-the-fact (the `EPUBLISHCONFLICT` case from the AC).
- **`scripts/generate-release-notes.mjs`** — port directly from Swift's `scripts/generate-release-notes.mjs`. Uses `@semantic-release/release-notes-generator` against a commit range; emits `notes.md`.
- **`scripts/preview-release.mjs`** — port directly from Swift's. Used by commit-lint to show the predicted next version on every PR.
- **`scripts/release-validate.mjs`** — semver + ≥ current-tag validation. Port + adapt.

### Phase 4 — GitHub Actions workflows

- **`.github/workflows/release.yml`** — `workflow_dispatch` with `version` (required), `dry-run` (bool), `dist-tag` (default `latest`).
  - Setup Node 20 + pnpm 9 (matches repo's `engines`).
  - Auth: configure for OIDC publish (`permissions: id-token: write`); fall back to `NPM_TOKEN` env if OIDC isn't usable.
  - Run `bash scripts/release.sh`.
- **`.github/workflows/manual-npm-publish.yml`** — `workflow_dispatch` with `version`. Idempotent retry of just the publish step (calls `scripts/publish-npm.sh`). Mirrors Swift's `manual-pod-publish.yml` — used to recover from a publish-only failure without re-running the full pipeline.
- **`.github/workflows/commit-lint.yml`** — `on: pull_request`. Runs commitlint against `origin/${{ github.event.pull_request.base.ref }}..${{ github.event.pull_request.head.sha }}`. Calls `scripts/preview-release.mjs` to compute the predicted next version. Upserts a single PR comment with marker `<!-- commit-lint-bot -->`.

### Phase 5 — commitlint config

- **`commitlint.config.js`** — extends `@commitlint/config-conventional`. Adds:
  ```js
  ignores: [(m) => /^chore\(release\): \d+\.\d+\.\d+/.test(m)],
  ```

### Phase 6 — Docs

- **`RELEASING.md`** — operator guide. How to dispatch a release; the version-input semantics; what happens if you re-dispatch; pointer to runbook for any "something went wrong" path.
- **`RELEASE-RUNBOOK.md`** — failure modes. Covers, per the AC, at minimum:
  1. **npm registry transient failure** (timeout / 5xx)
  2. **`EPUBLISHCONFLICT` after success** (workflow reported failure, version is actually on registry)
  3. **Provenance attestation failure** (publish succeeded but signing didn't, or vice versa)
  4. **Expired / invalid `NPM_TOKEN`**
  5. **OTP/2FA error class** (CI hit a user token requiring 2FA — wrong token type)
  6. **Rogue tag** (tag exists on origin but tree content doesn't match `$VERSION`)
  7. **Wrong `VERSION` input** (invalid semver, or ≤ current tag, or skips a major)
  8. **GitHub release create fails after tag pushed**
  9. **Dev-restore push fails because main diverged**
  10. **Partial pnpm-workspace publish** (in case we ever publish more than one package)
- Update `AGENTS.md` and `CONTRIBUTING.md` to link to RELEASING.md + RELEASE-RUNBOOK.md.

### Phase 7 — Required CI gates

Branch protection on `main` should add as required status checks:
- `Commit Lint`
- `lint`, `typecheck`, `test` (existing)
- `build` (new — added in Phase 1)

Out-of-band step for a repo admin; called out in the PR description.

## Acceptance Criteria mapping

| AC | Phase | Resolution |
|---|---|---|
| Fresh release ships across GitHub + npm in one dispatch | 3, 4 | `release.yml` + `release.sh` |
| Mid-flight failure recovers by re-dispatching | 3 | `release.sh` resume detection + idempotent steps |
| `npm view` shows correct version after `EPUBLISHCONFLICT`-after-success | 3 | `publish-npm.sh` post-check + classification |
| `RELEASE-RUNBOOK.md` covers the listed failure modes | 6 | New file |
| `RELEASING.md` reviewed and merged | 6 | New file |
| commit-lint uses current-main as lower bound + ignores release commits | 4, 5 | `commit-lint.yml` range + commitlint `ignores` |
| Engineering implementation plan committed | (this doc) | `docs/release-hardening-plan.md` |

## Open questions

1. **Auth path.** The cleanest publish surface is OIDC + provenance, but it requires this repo to be part of the org's npm-publish trust policy. Is that set up, or do we need to start with `NPM_TOKEN`? If the latter, we still wire OIDC as the future-default in the workflow with a feature-flagged switch.
2. **Scope of "BREAKING CHANGE requires manual approval"** (the last line of YPE-2789's ticket body). This phrasing matches the breaking-change signoff gate we just shipped in Swift under [YPE-2521](https://github.com/youversion/platform-sdk-swift/pull/144). Is that gate **in scope for YPE-2789**, or is it a separate sibling ticket pending? The pattern ports cleanly — a `.github/workflows/major-release-signoff.yml` analog using the same matcher logic — and the same parent Notion doc explicitly says the gate will replicate to React Native. Flagging so we can either include it in this PR or open a sibling ticket.
3. **`dist-tag` default.** `latest` is the safe default for the first published version. Once we ship a `next` / `beta` channel (whenever that's a real need), the resume-mode preservation logic gets exercised. No work needed for this PR if we're shipping `latest` only — flag for follow-up.
4. **What's the first version we ship?** Current `0.0.1` is the dev placeholder. First real release should be `0.1.0` or `1.0.0` depending on stability stance. Out of scope for this ticket but worth deciding before the workflow actually gets dispatched.
5. **Build target.** Does `packages/ui/` need to ship CJS + ESM + types, or just ESM + types? The current `src/index.ts` shape suggests ESM-only is fine. Confirm with consumers.

## Out of scope

Per the ticket:
- Migrating to a different registry (GitHub Packages, jsr).
- Changing the SemVer scheme.
- Auto-publishing on merge.

Adding to that for clarity:
- Renaming / restructuring the package(s).
- Backporting the hardening pattern further to other sibling SDKs (Kotlin, RN-vanilla, React-Web) — separate tickets.
- Changesets adoption (we explicitly stick with manual `workflow_dispatch` + explicit version input, matching Swift).

## Estimated effort

| Phase | Approx. time |
|---|---|
| Build infrastructure | 1–2h |
| Version-stamping | 1h |
| Release scripts (porting + adapting) | 3–4h |
| Workflows | 2h |
| commitlint config + workflow | 1h |
| Docs (RELEASING + RELEASE-RUNBOOK) | 2–3h |
| **Subtotal** | **10–13h** |

Plus PR review and any iteration. Realistic total: 1.5–2 days of focused work.

## Validation plan

1. **Dry-run dispatch.** `release.yml` with `dry-run: true` end-to-end on a feature branch — exercises every step up to `npm publish`, stopping before the registry write.
2. **Fresh release rehearsal.** Dispatch with a deliberately-low test version against a private mirror or a `--dry-run`-ed npm publish. Confirm tag, release, and Dev-restore all land.
3. **Simulated resume.** Dispatch, kill the workflow after the tag pushes (or after a fake `npm publish` that fails transiently). Re-dispatch the same version. Confirm tag is reused, publish completes, Dev-restore happens.
4. **EPUBLISHCONFLICT rehearsal.** Manually publish a version to the registry, then dispatch the release with the same version. The publish step should detect "already there" and proceed to Dev-restore.
5. **Wrong-input rejection.** Dispatch with `0.0.1` (≤ current tag) — script should refuse with the documented error.

## Source pattern artifacts referenced

For implementers porting from Swift, the canonical reference files (read-only on the Swift repo's `YPE-2684` branch):
- `scripts/release.sh`
- `scripts/publish-pods.sh` (template for `publish-npm.sh`)
- `scripts/restore-dev-sdk-on-main.sh`
- `scripts/generate-release-notes.mjs`
- `scripts/preview-release.mjs`
- `scripts/release-validate.mjs`
- `RELEASE-RUNBOOK.md`
- `.github/workflows/release.yml`
- `.github/workflows/manual-pod-publish.yml`
- `.github/workflows/commit-lint.yml`
- `commitlint.config.js`

# Release Runbook

When a dispatched release fails partway, this runbook is the single place to look up the symptom, confirm the actual state, and run the right recovery. It assumes you've read [RELEASING.md](./RELEASING.md) for the normal happy-path flow.

## Recovery cheat sheet

For most partial failures, the answer is **re-dispatch `release.yml` with the same version**. `scripts/release.sh` detects when tag `$VERSION` already exists on origin and enters resume mode: it checks out the tag, regenerates release notes, and runs the remaining steps idempotently. Each step (`git push`, `gh release create`, `npm publish`, Dev-restore) detects already-completed work and skips it.

```bash
gh workflow run release.yml -f version=<the same version that just failed>
```

The exceptions — where you should _not_ just re-dispatch — are at the bottom under "When re-dispatch is unsafe."

## State to check before recovering

Run these commands on a fresh clone (or `cd` into the repo and `git fetch --tags origin`):

```bash
VERSION=<the version>

# Tag on origin?
git ls-remote origin "refs/tags/$VERSION"

# Local main HEAD: X (release commit) or Y (Dev-restore)?
git log origin/main -2 --format='%h %s'

# Packages on npm?
for p in @youversion/platform-react-native-expo-core @youversion/platform-react-native-expo-ui; do
  echo "== $p =="
  npm view "${p}@${VERSION}" version 2>/dev/null || echo "  NOT on npm"
done

# GitHub release exists?
gh release view "$VERSION" --json name,tagName,createdAt 2>/dev/null || echo "  NO release"
```

The four signals — `tag on origin?`, `main HEAD = X or Y?`, `packages on npm?`, `release exists?` — uniquely identify which phase the original run reached.

---

## Failure modes

### 1. npm registry transient failure (timeout / 5xx / network)

**Symptom.** During `publish-npm.sh`, one of the two `pnpm publish` calls exits non-zero with one of: `ETIMEDOUT`, `ECONNRESET`, `EAI_AGAIN`, `503 Service Unavailable`, `502 Bad Gateway`, `504 Gateway Time-out`, `fetch failed`, `Could not resolve host`.

**State check.** `npm view <pkg>@<version>` for both packages — transient failures may or may not have recorded the publish before the error surfaced.

**Recovery.** Re-dispatch `release.yml -f version=$VERSION`. Resume mode engages, the per-package idempotency check skips anything npm did record, and `publish-npm.sh` retries the failed publish once with a 30s backoff before continuing. If both attempts on the same package fail, the script exits — re-dispatch again (the second dispatch's `npm view` check will recognise anything that landed in the meantime).

**Expected end state.** Both packages at `$VERSION` on npm; main HEAD = Y (Dev-restore).

---

### 2. `EPUBLISHCONFLICT` after success (workflow reported failure, registry actually has the version)

**Symptom.** `pnpm publish` exits non-zero with `EPUBLISHCONFLICT` or `You cannot publish over the previously published versions`, but `npm view @youversion/platform-react-native-expo-core@$VERSION` returns `$VERSION`. The registry accepted the publish; the response came back as a conflict because the registry's own deduplication fired before the response was sent.

The classifier in `publish-npm.sh` handles this in-band: after a non-zero exit it re-runs `npm view` and, on success, treats the publish as success-after-the-fact and continues. The runbook entry exists for when that classification *doesn't* catch it (e.g. transient connectivity loss between the publish and the recheck).

**State check.** `npm view <pkg>@<version> version` returns the version.

**Recovery.** Re-dispatch `release.yml -f version=$VERSION`. The per-package idempotency check sees the version on the registry and skips the publish entirely. Dev-restore runs as the final step.

**Expected end state.** Both packages at `$VERSION` on npm; main HEAD = Y.

---

### 3. Provenance attestation failure

**Symptom.** `pnpm publish` exits non-zero with text mentioning `attestation`, `provenance`, `OIDC`, or similar. The package itself may or may not have published. Provenance is generated *alongside* the publish; either can fail independently of the other.

**Possible underlying causes:**

- `id-token: write` permission missing from the workflow (it isn't on `release.yml` and `manual-npm-publish.yml`).
- The npm-side trust policy for this repo isn't configured for one of the two packages.
- npm's provenance service is having an outage (rare, treated as transient).

**State check.** `npm view <pkg>@<version>` — if the version is there, publish succeeded; only the attestation is missing. The release is still safe to consume.

**Recovery.**

- If the version is **on the registry**: re-dispatch is *not* necessary. The release is usable. If you specifically need the attestation:
  1. Verify `id-token: write` is in the workflow's `permissions:` block. (It is in the version of `release.yml` shipped under YPE-2790.)
  2. Verify the npm trust policy lists this workflow as a trusted publisher.
  3. If both are correct and the failure persists, npm provenance may be down. Treat as transient and re-attempt later — `manual-npm-publish.yml` will attempt to attest if dispatched against the same tag.
- If the version is **not on the registry**: re-dispatch `release.yml -f version=$VERSION` (or, surgically, `manual-npm-publish.yml -f version=$VERSION`). Resume mode handles the rest.

**Expected end state.** Both packages at `$VERSION` on npm, ideally with provenance.

---

### 4. Expired / invalid `NPM_TOKEN`

**Symptom.** `pnpm publish` exits non-zero with `E401`, `EAUTH`, `EUNAUTHORIZED`, `E403`, or `EFORBIDDEN`. These are **hard-fail signatures** — `publish-npm.sh` aborts the whole script on the first attempt without retry, because retrying with a bad token is wasteful and noisy.

**State check.** Locally, run `npm whoami --userconfig <copy of the workflow's .npmrc>` or check the npm dashboard for token expiry.

**Recovery.**

1. Generate a new **Automation** token (not Publish, not Read-only) on npm.
2. Update the `NPM_TOKEN` repo secret at `https://github.com/youversion/platform-sdk-reactnative-expo/settings/secrets/actions`.
3. Re-dispatch `release.yml -f version=$VERSION`. If the tag was already pushed before the auth failure, resume mode engages; otherwise it's a fresh run.

**Expected end state.** Both packages at `$VERSION` on npm.

> **The token must be an Automation token.** A Publish token requires 2FA on every publish, which CI cannot satisfy. See #5.

---

### 5. OTP / 2FA error class

**Symptom.** `pnpm publish` exits non-zero with `EOTP`, `need a one-time password`, `OTP required`, or similar. This means the token in use is a **Publish** or user token, not an **Automation** token — npm is asking for a 2FA OTP on every publish.

**Why it happens.** Automation tokens explicitly bypass 2FA-on-publish for CI use. Publish tokens require 2FA. User tokens also require 2FA if the account has it on. CI cannot prompt for an OTP, so the publish fails immediately.

**State check.** None needed — the error message is unambiguous.

**Recovery.**

1. On https://www.npmjs.com/settings/<user>/tokens, generate an **Automation** token with publish rights for `@youversion/*`. Be careful to choose **Automation**, not **Publish**.
2. Replace the `NPM_TOKEN` repo secret.
3. Re-dispatch `release.yml -f version=$VERSION`.

**Expected end state.** Both packages at `$VERSION` on npm.

---

### 6. Rogue tag (tag content does not match `$VERSION`)

**Symptom.** Resume mode aborts during the tag-content verification with `❌ Tag $VERSION exists but packages/core/src/version.ts at the tag does not read "$VERSION"`. Either:

- A previous release was force-pushed or hand-edited.
- The tag was created by a different process (manual `git tag` on a feature branch).
- A previous attempt landed a tag pointing at a tree that didn't run `stamp-version.sh`.

**State check.**

```bash
git show "refs/tags/$VERSION:packages/core/src/version.ts" | grep SDK_VERSION
git show "refs/tags/$VERSION:packages/core/package.json" | grep '"version"'
git show "refs/tags/$VERSION:packages/ui/package.json" | grep '"version"'
```

All three should read `$VERSION`. If any disagrees, the tag is rogue.

**Recovery — do not auto-heal.** The script's refusal is correct; healing the wrong tag would publish unrelated work.

1. Decide whether the consumers can already see this tag. If `npm view <pkg>@<version>` returns something, the publish already happened against a tree that wasn't fully stamped — you cannot recover by re-tagging; you must release a patch version with a clean tag.
2. If `npm view` doesn't return the version, the tag is harmless. Delete it: `git push origin :refs/tags/$VERSION`. Then dispatch with the same or next version.

**Expected end state.** Either a clean patch released over the broken one, or the rogue tag deleted and the original `$VERSION` released cleanly.

---

### 7. Wrong `VERSION` input

**Symptom.** Workflow aborts at the validation step with `not_semver` or `not_strictly_greater`. The dispatcher typed something that isn't valid semver (`0.1`, `1.x`) or is `≤` the current tag (when not resuming).

**State check.** Confirm the input by looking at the failed workflow's `Run release orchestrator` step header.

**Recovery.** Re-dispatch with a corrected input. No cleanup needed — the script fails before any side effects.

If you genuinely need to ship a lower version (e.g. backporting a patch to a previous major), that workflow doesn't support it yet — see "Future work" at the bottom.

---

### 8. GitHub release create fails after tag is pushed

**Symptom.** Tag `$VERSION` exists on origin; `gh release view $VERSION` says `release not found`. The original workflow died between the tag push and the `gh release create` step (gh CLI error, GitHub API outage, GITHUB_TOKEN scope issue).

**State check.** `git ls-remote origin refs/tags/$VERSION` non-empty; `gh release view $VERSION` returns 404; `npm view` may show one or both packages.

**Recovery.** Re-dispatch `release.yml -f version=$VERSION`. Resume mode skips the already-completed push, runs `gh release create` (idempotent — it skips if the release exists), publishes whatever's still unpublished, and creates Y.

**Expected end state.** GitHub release for `$VERSION` exists; both packages on npm; main HEAD = Y.

---

### 9. Dev-restore push fails because `main` diverged

**Symptom.** Everything published, but `restore-dev-sdk-on-main.sh`'s final `git push origin HEAD:main` fails with `Updates were rejected because the remote contains work that you do not have locally` or similar.

This happens when something landed on `main` between the release X push and the Dev-restore push — usually a hand-edit by another contributor who didn't see the release in flight.

**State check.** `git log origin/main -3 --format='%h %s'` shows commits between X and main HEAD that aren't from the release.

**Recovery.** Re-dispatch `release.yml -f version=$VERSION`. Resume mode reads the now-diverged `origin/main`, recognises X is reachable from `main` via the foreign commits (the `git merge-base --is-ancestor` check), and skips the main push and tag push. It then runs Dev-restore on top of the current `main` HEAD, producing topology `X → C → Y` where `C` is the foreign commit.

**Expected end state.** main HEAD = Y on top of whatever landed between X and the Dev-restore.

> **Watch for:** if the foreign commit also touched `packages/core/src/version.ts`, the Dev-restore may merge-conflict. Resolve manually by checking out main, editing the file to `SDK_VERSION = "Dev"`, and pushing as a normal commit.

---

### 10. Partial workspace publish (`core` succeeded, `ui` failed — or vice versa)

**Symptom.** `npm view core@$VERSION` returns the version but `npm view ui@$VERSION` does not, or the reverse.

**Why it happens.** `publish-npm.sh` publishes packages serially with retry. If `core` succeeds but the retry budget runs out on `ui`, the script exits with `core` already on the registry.

**State check.** `npm view` for each package.

**Recovery.** Re-dispatch `release.yml -f version=$VERSION`. The script's idempotency check skips `core`'s publish (already on registry) and retries `ui`. Use `manual-npm-publish.yml -f version=$VERSION` if you only want the publish step to re-run and not Dev-restore.

**Expected end state.** Both packages at `$VERSION` on npm.

> **`workspace:*` consistency check:** when `ui` re-publishes against the already-on-registry `core`, pnpm rewrites `workspace:*` to the actual published `core` version. If something went wrong with that rewrite, see #11.

---

### 11. `workspace:*` was not rewritten in the published `ui` tarball

**Symptom.** Consumers install `@youversion/platform-react-native-expo-ui@$VERSION` and see an error like `Cannot resolve workspace:* outside a workspace` or `Unsupported URL Type "workspace:": workspace:*` in their install logs.

**Why it happens.** pnpm is supposed to rewrite `workspace:*` at publish time, but if the publish was done with a non-pnpm tool, with `--no-pnpm-publish` semantics, or with an unusual `publishConfig`, the literal `workspace:*` reference can ship in the tarball.

**State check.**

```bash
mkdir -p /tmp/inspect-ui && cd /tmp/inspect-ui
npm pack "@youversion/platform-react-native-expo-ui@$VERSION"
tar -xzf youversion-platform-react-native-expo-ui-${VERSION}.tgz
node -p "require('./package/package.json').dependencies"
```

The `core` dependency should be `^$VERSION` (or `~$VERSION`), not `workspace:*`.

**Recovery.** If the published tarball is broken, the only safe recovery is:

1. Mark the broken version: `npm dist-tag rm @youversion/platform-react-native-expo-ui $DIST_TAG` (so `latest` doesn't point at it), then optionally `npm deprecate @youversion/platform-react-native-expo-ui@$VERSION "broken workspace:* — use ${NEXT_VERSION}"`.
2. Release a patch: `gh workflow run release.yml -f version=$NEXT_VERSION` where `$NEXT_VERSION` is the next patch.

**Why not unpublish?** npm's 72-hour unpublish window has historically been narrowed; treat `pnpm unpublish` as best-effort and prefer deprecation + a patch.

---

### 12. Peer-dep version skew with consumer projects (RN-specific)

**Symptom.** Consumers report install errors like `incorrect peer dependency` or runtime errors like `Module RNCSafeAreaContext is null` after upgrading to a new SDK version. Their `react-native` / `expo` / `react-native-reanimated` / `react-native-mmkv` / `react-native-safe-area-context` / etc. doesn't satisfy the SDK's `peerDependencies` range.

**State check.** Read `packages/ui/package.json#peerDependencies` and `packages/core/package.json#peerDependencies` for the released version (e.g. `npm view @youversion/platform-react-native-expo-ui@$VERSION peerDependencies`). Cross-reference with the consumer's `package.json`.

**Recovery — two options:**

- **Consumer upgrades.** Document the required peer-dep ranges in the GitHub release notes. Consumers update their RN / Expo / native modules to a satisfying version.
- **SDK widens the range.** If a swath of consumers are affected and the SDK *would actually work* with the older peer-dep, ship a patch widening `peerDependencies`. Be conservative — widening too far papers over a real incompatibility and produces opaque runtime crashes.

**Prevention.** Before bumping a major peer-dep range (e.g. `expo >=55` → `expo >=56`), document it in the PR body so the analyzer's MAJOR classification is intentional. The breaking-change signoff gate (tracked separately from YPE-2790) will surface this at PR review time.

---

### 13. Future-native artifact failures (currently no-op)

This SDK is currently pure TypeScript — no `.h` / `.m` / `.swift` / `.kt` / `.java` / `.podspec` / `.gradle` / codegen specs. The following failure classes are stubbed out today and become live if native sources are added:

| Class | What to watch for if/when native code lands |
|---|---|
| iOS / Android source stamps drift from `package.json#version` | `stamp-version.sh` needs to extend to podspec / build.gradle / native version constants. Verification step needed in the workflow. |
| Codegen output missing from published tarball | `npm pack` + `tar -tzf` post-publish to verify the codegen-emitted files are present. Add to `publish-npm.sh` or as a separate verification step. |
| Hermes / new arch / old arch partial publish | If the SDK ever ships arch-specific artifacts, they need to publish atomically (all-or-nothing). Resume mode must preserve the arch identifier. |
| Native-source mismatch from stamp (CocoaPods / Gradle vs package.json) | A check that the version stamped in native manifests matches `package.json#version`. Fail-fast before publish. |

When any of these become real, mirror the pattern from [`platform-sdk-swift`'s RELEASE-RUNBOOK.md](https://github.com/youversion/platform-sdk-swift/blob/main/RELEASE-RUNBOOK.md) for the CocoaPods analogs.

---

## When re-dispatch is unsafe

Three scenarios where you should *not* just re-dispatch the same version:

1. **Rogue tag with content mismatching `$VERSION`.** See #6 — re-dispatch will refuse, and that refusal is correct.
2. **Wrong `$VERSION` input (skipped a major, lower than current, invalid semver).** See #7 — re-dispatch with the correct input.
3. **You want to change what's being released.** Re-dispatch always publishes whatever is at the tagged commit X. To change the released content, you have to land a fix on `main` and ship a *new* version.

For everything else: same VERSION → re-dispatch → done.

## Future work (not in YPE-2790)

- **`release-warn-version-jump.mjs`** — Swift's release script warns when the chosen version is more than one major above the analyzer's suggestion. Not ported here; would catch typo-driven version explosions.
- **Backport release path** — current `release.sh` requires `$VERSION > current tag`. Backporting a patch to a previous major would need a `--backport` switch.
- **Native artifact verification** — see #13.
- **Breaking-change signoff gate** — sibling ticket tracking the port of [`platform-sdk-swift#YPE-2521`](https://github.com/youversion/platform-sdk-swift) to this repo. Once landed, every major-classified PR will require an explicit collaborator signoff comment before merge.

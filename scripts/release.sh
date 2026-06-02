#!/usr/bin/env bash
# Manual version-input release orchestrator for the dual-package npm
# workspace.
#
# Called by .github/workflows/release.yml after `workflow_dispatch` with
# `inputs.version`. Bypasses semantic-release entirely. The analyzer and
# release-notes-generator modules are still used as libraries via
# scripts/preview-release.mjs and scripts/generate-release-notes.mjs,
# but orchestration is local — no env-ci, no verifyAuth, no lifecycle.
#
# Fresh-run pre-conditions
# - VERSION env var: the chosen target version.
# - HEAD = origin/main HEAD.
# - packages/core/src/version.ts reads SDK_VERSION="Dev".
# - Working tree clean.
# - GH_TOKEN (or GITHUB_TOKEN) exported for `gh release create`.
# - npm auth available: either NPM_TOKEN env, or OIDC + `--provenance`
#   (which the workflow sets up via `id-token: write`).
#
# Resume mode (auto-detected): if tag $VERSION already exists on origin
# with a tree that has SDK_VERSION + both package.json#version stamped to
# $VERSION, the script treats this as a re-dispatch after a prior partial
# run. It checks out the tag, regenerates release notes, and proceeds to
# the idempotent post-tag steps (push, GitHub release, npm publish,
# Dev-restore), each of which detects and skips already-completed work.
# See RELEASE-RUNBOOK.md.
#
# Post-conditions on success
# - Tag $VERSION points at commit X (chore(release) commit stamping
#   SDK_VERSION + both package.json#version + prepending CHANGELOG entry).
# - main HEAD = Y (Dev-restore commit on top of X).
# - GitHub release created from generated notes.
# - Both workspace packages (core, ui) published at $VERSION on npm.
#
# Local usage (validates and stops before push):
#   VERSION=0.1.0 DRY_RUN=1 bash scripts/release.sh
#
# CI usage:
#   VERSION=0.1.0 bash scripts/release.sh

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${VERSION:-}"
DRY_RUN="${DRY_RUN:-0}"
DIST_TAG="${DIST_TAG:-latest}"

if [ -z "$VERSION" ]; then
  echo "❌ VERSION env var is required" >&2
  exit 1
fi

# --- Validate VERSION --------------------------------------------------------

CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "0.0.0")
echo "Current tag:    $CURRENT_TAG"
echo "Chosen version: $VERSION"
echo "Dist tag:       $DIST_TAG"

VALIDATION_CODE=0
node scripts/release-validate.mjs "$VERSION" "$CURRENT_TAG" || VALIDATION_CODE=$?

# Detect resume *before* failing on "not strictly greater" — re-dispatch
# with the same version must recover a partial run, not exit.
REMOTE_TAG_SHA=$(git ls-remote origin "refs/tags/$VERSION" 2>/dev/null | awk '{print $1}')
RESUME=0
if [ -n "$REMOTE_TAG_SHA" ]; then
  RESUME=1
fi

if [ "$VALIDATION_CODE" -eq 11 ]; then
  echo "❌ '$VERSION' is not valid semver" >&2
  exit 1
elif [ "$VALIDATION_CODE" -eq 12 ] && [ "$RESUME" = "0" ]; then
  echo "❌ '$VERSION' is not strictly greater than current tag '$CURRENT_TAG'" >&2
  exit 1
elif [ "$VALIDATION_CODE" -ne 0 ] && [ "$VALIDATION_CODE" -ne 12 ]; then
  echo "❌ Version validation failed (exit $VALIDATION_CODE)" >&2
  exit 1
fi

# --- Compute calculated version (informational) ------------------------------

PREVIEW_JSON=$(node scripts/preview-release.mjs --base "$CURRENT_TAG" --head HEAD 2>/dev/null || echo '{}')
CALCULATED=$(echo "$PREVIEW_JSON" | node -e "let s=''; process.stdin.on('data', d=>s+=d).on('end', () => { const j=JSON.parse(s||'{}'); console.log(j.next || j.current || 'unknown'); });")
CALC_TYPE=$(echo "$PREVIEW_JSON" | node -e "let s=''; process.stdin.on('data', d=>s+=d).on('end', () => { const j=JSON.parse(s||'{}'); console.log(j.release_type || 'none'); });")
echo "Calculated:     $CALCULATED ($CALC_TYPE)"

# Side-by-side audit block in the GitHub Step Summary.
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Release \`$VERSION\`"
    echo
    echo "| Source            | Version            |"
    echo "| ----------------- | ------------------ |"
    echo "| Current tag       | \`$CURRENT_TAG\`   |"
    echo "| Analyzer-computed | \`$CALCULATED\` ($CALC_TYPE) |"
    echo "| Chosen (input)    | **\`$VERSION\`**   |"
    echo "| dist-tag          | \`$DIST_TAG\`      |"
    if [ "$RESUME" = "1" ]; then
      echo
      echo "> 🔁 **Resume mode** — tag \`$VERSION\` already exists on origin. Will skip already-completed phases."
    fi
    if [ "$DRY_RUN" = "1" ]; then
      echo
      echo "> 🧪 **DRY_RUN=1** — workflow will stop before push/publish/restore."
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

# --- Resume-mode setup -------------------------------------------------------
#
# When tag $VERSION already exists on origin, verify the tag's tree
# matches what a normal release would have produced, then check the tag
# out so HEAD is X regardless of where origin/main currently points.
#
# Why content-verify the tag: a rogue or mismatched tag (different
# content, moved by hand, leftover from a different process) must abort,
# not silently heal.
#
# Why overlay scripts/ from origin/main: the tag predates the resume
# logic of any post-tag fix that may have shipped since. Running
# publish-npm.sh from the tagged tree could lose retry/backoff fixes.

if [ "$RESUME" = "1" ]; then
  echo
  echo "🔁 Resume mode: tag $VERSION already exists on origin at $REMOTE_TAG_SHA."

  if ! git rev-parse "refs/tags/$VERSION^{}" >/dev/null 2>&1; then
    git fetch origin "refs/tags/$VERSION:refs/tags/$VERSION"
  fi

  TAG_VERSION_LINE=$(git show "refs/tags/$VERSION:packages/core/src/version.ts" 2>/dev/null \
    | grep 'SDK_VERSION' | head -1 || echo "")
  if ! echo "$TAG_VERSION_LINE" | grep -qF "export const SDK_VERSION = \"$VERSION\""; then
    echo "❌ Tag $VERSION exists but packages/core/src/version.ts at the tag does not read \"$VERSION\"." >&2
    echo "   Found: $TAG_VERSION_LINE" >&2
    echo "   Refusing to resume against a tag whose content does not match. See RELEASE-RUNBOOK.md." >&2
    exit 1
  fi
  for MANIFEST in packages/core/package.json packages/ui/package.json; do
    MANIFEST_VERSION=$(git show "refs/tags/$VERSION:${MANIFEST}" 2>/dev/null \
      | node -e "let s=''; process.stdin.on('data', d=>s+=d).on('end', () => { try { console.log(JSON.parse(s).version || ''); } catch { console.log(''); } });" \
      || echo "")
    if [ "$MANIFEST_VERSION" != "$VERSION" ]; then
      echo "❌ Tag $VERSION's ${MANIFEST} reads version \"$MANIFEST_VERSION\", expected \"$VERSION\"." >&2
      echo "   Refusing to resume against a tag whose content does not match. See RELEASE-RUNBOOK.md." >&2
      exit 1
    fi
  done
  echo "  ✓ Tag $VERSION content matches (SDK_VERSION + both package.json#version all stamped to $VERSION)."

  git checkout --detach "refs/tags/$VERSION"

  # Replace scripts/ with origin/main's copy so we pick up post-tag fixes
  # (retry-with-backoff, idempotency checks, etc.) when re-running.
  git fetch origin main 2>/dev/null || true
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    git checkout origin/main -- scripts/
    echo "  ✓ Overlaid scripts/ from origin/main so resume uses the latest publish logic."
  fi

  # Regenerate notes using the same commit range the original run used.
  PREV_TAG=$(git describe --tags --abbrev=0 "refs/tags/$VERSION^" 2>/dev/null || echo "")
  if [ -z "$PREV_TAG" ]; then
    echo "❌ Could not derive previous tag (parent of $VERSION)." >&2
    exit 1
  fi
  echo "  Regenerating release notes for $VERSION (from $PREV_TAG)..."
  node scripts/generate-release-notes.mjs \
    --base "$PREV_TAG" \
    --head "$VERSION" \
    --version "$VERSION" \
    > notes.md
  echo "  Notes: $(wc -l < notes.md | tr -d ' ') lines."
fi

# --- Fresh-run preflight + commit-X build -----------------------------------

if [ "$RESUME" = "0" ]; then
  if ! grep -qF 'export const SDK_VERSION = "Dev"' packages/core/src/version.ts; then
    echo "❌ packages/core/src/version.ts does not currently read \"Dev\" — main is in an unexpected state" >&2
    echo "   Current: $(grep 'SDK_VERSION' packages/core/src/version.ts | head -1)" >&2
    exit 1
  fi

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ Working tree is dirty — aborting" >&2
    git status --short >&2
    exit 1
  fi

  # Guard against a non-main dispatch landing feature-branch commits on
  # main. Dry-runs are explicitly supported on any branch.
  if [ "$DRY_RUN" != "1" ]; then
    HEAD_SHA_CHECK=$(git rev-parse HEAD)
    MAIN_SHA_CHECK=$(git rev-parse origin/main 2>/dev/null || echo "")
    if [ -z "$MAIN_SHA_CHECK" ]; then
      echo "❌ origin/main ref not found locally — workflow checkout must use fetch-depth: 0" >&2
      exit 1
    fi
    if [ "$HEAD_SHA_CHECK" != "$MAIN_SHA_CHECK" ]; then
      echo "❌ HEAD ($HEAD_SHA_CHECK) is not at origin/main ($MAIN_SHA_CHECK)" >&2
      echo "   Live releases must be dispatched on the main branch. Re-run with --ref main." >&2
      exit 1
    fi
  fi

  if git rev-parse "refs/tags/$VERSION" >/dev/null 2>&1; then
    echo "❌ Tag $VERSION already exists locally but not on origin — refusing to fresh-run." >&2
    echo "   If you intended to resume, push the tag first or delete it locally." >&2
    exit 1
  fi

  # --- Generate release notes ------------------------------------------------
  echo
  echo "Generating release notes..."
  node scripts/generate-release-notes.mjs \
    --base "$CURRENT_TAG" \
    --head HEAD \
    --version "$VERSION" \
    > notes.md
  echo "Notes: $(wc -l < notes.md | tr -d ' ') lines."

  # --- Update CHANGELOG.md ---------------------------------------------------
  if [ -f CHANGELOG.md ]; then
    node - <<'NODE'
const fs = require('fs');
const notes = fs.readFileSync('notes.md', 'utf8').trimEnd() + '\n\n';
const existing = fs.readFileSync('CHANGELOG.md', 'utf8');
const m = existing.match(/^## \[/m);
let out;
if (m) {
  out = existing.slice(0, m.index) + notes + existing.slice(m.index);
} else {
  out = existing.trimEnd() + '\n\n' + notes;
}
fs.writeFileSync('CHANGELOG.md', out);
NODE
  else
    printf '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n' > CHANGELOG.md
    cat notes.md >> CHANGELOG.md
  fi
  echo "CHANGELOG.md updated."

  # --- Stamp version into manifests + SDK constant --------------------------
  bash scripts/stamp-version.sh "$VERSION"

  # --- Build X commit ------------------------------------------------------
  git add \
    CHANGELOG.md \
    packages/core/package.json \
    packages/ui/package.json \
    packages/core/src/version.ts

  {
    printf 'chore(release): %s [skip ci]\n\n' "$VERSION"
    cat notes.md
  } > .git/COMMIT_EDITMSG
  git commit -F .git/COMMIT_EDITMSG

  X_SHA=$(git rev-parse HEAD)
  echo "Commit X created at $X_SHA."

  # --- Tag X ---------------------------------------------------------------
  git tag "$VERSION"
  echo "Tag $VERSION created at $X_SHA."
else
  X_SHA=$(git rev-parse HEAD)
  echo "  ✓ Using existing tag $VERSION at $X_SHA as commit X."
fi

# --- Dry-run exit (both modes) ----------------------------------------------

if [ "$DRY_RUN" = "1" ]; then
  echo
  if [ "$RESUME" = "1" ]; then
    echo "DRY_RUN=1 (resume mode) — stopping before push, GitHub release, npm publish, and Dev restore."
    echo "Inspect locally:"
    echo "  cat notes.md"
    echo "  git log -1 $VERSION"
  else
    echo "DRY_RUN=1 — stopping before push, GitHub release, npm publish, and Dev restore."
    echo "Inspect locally:"
    echo "  git log -1"
    echo "  git tag -l '$VERSION'"
    echo "  cat notes.md"
  fi
  exit 0
fi

# --- Push main + tag (idempotent) -------------------------------------------

echo
echo "Pushing main and tag $VERSION..."

git fetch origin main 2>/dev/null || true
ORIGIN_MAIN_SHA=$(git rev-parse origin/main 2>/dev/null || echo "")

if [ "$RESUME" = "0" ]; then
  git push origin HEAD:main
elif [ "$ORIGIN_MAIN_SHA" = "$X_SHA" ]; then
  echo "  ✓ origin/main already at $X_SHA — skipping main push."
elif [ -n "$ORIGIN_MAIN_SHA" ] && git merge-base --is-ancestor "$X_SHA" "$ORIGIN_MAIN_SHA" 2>/dev/null; then
  echo "  ✓ origin/main has advanced past X (likely Y already created) — skipping main push."
else
  echo "❌ Resume mode: tag $VERSION at $X_SHA is not reachable from origin/main ($ORIGIN_MAIN_SHA)." >&2
  echo "   Refusing to push from a detached state that doesn't descend from main. See RELEASE-RUNBOOK.md." >&2
  exit 1
fi

REMOTE_TAG_NOW=$(git ls-remote origin "refs/tags/$VERSION" 2>/dev/null | awk '{print $1}')
if [ -z "$REMOTE_TAG_NOW" ]; then
  git push origin "$VERSION"
elif [ "$REMOTE_TAG_NOW" = "$X_SHA" ]; then
  echo "  ✓ Tag $VERSION already at $X_SHA on origin — skipping tag push."
else
  echo "❌ Tag $VERSION on origin points at $REMOTE_TAG_NOW, but local X is $X_SHA." >&2
  echo "   Refusing to force-update tags. See RELEASE-RUNBOOK.md." >&2
  exit 1
fi

# --- Create GitHub release (idempotent) -------------------------------------

echo
if gh release view "$VERSION" >/dev/null 2>&1; then
  echo "GitHub release $VERSION already exists — leaving as-is."
else
  echo "Creating GitHub release..."
  gh release create "$VERSION" --notes-file notes.md --title "$VERSION"
fi

# --- Build dist/ before publish (every run, fresh + resume) -----------------
#
# pnpm publish needs dist/ to exist with the stamped version. Run the
# build now so the published tarball reflects the tagged tree's TS
# source. .gitignore excludes dist/ so the build artifacts don't end up
# committed to either X or Y.

echo
echo "Building publishable packages..."
pnpm install --frozen-lockfile
pnpm exec turbo run build

# --- Publish to npm (idempotent per-package + retry on transient) -----------

echo
echo "Publishing packages..."
VERSION="$VERSION" DIST_TAG="$DIST_TAG" bash scripts/publish-npm.sh

# --- Restore Dev on main (Y commit) -----------------------------------------

if [ "$RESUME" = "1" ]; then
  echo
  echo "Resume: checking out main before Dev-restore..."
  git fetch origin main
  git checkout -B main origin/main
fi

echo
echo "Restoring SDK_VERSION to Dev on main..."
bash scripts/restore-dev-sdk-on-main.sh "$VERSION"

Y_SHA=$(git rev-parse HEAD)

rm -f notes.md

echo
echo "✅ Release $VERSION complete."
echo "   Tag $VERSION -> $X_SHA (commit X)"
echo "   main HEAD     -> $Y_SHA (commit Y, SDK_VERSION=\"Dev\")"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo
    echo "### ✅ Released"
    echo
    echo "- Tag \`$VERSION\` → \`$X_SHA\` (commit X)"
    echo "- main HEAD → \`$Y_SHA\` (commit Y)"
    echo "- GitHub release: [\`$VERSION\`](https://github.com/${GITHUB_REPOSITORY:-youversion/platform-sdk-reactnative-expo}/releases/tag/$VERSION)"
    echo "- npm: [\`@youversion/platform-react-native-expo-core@$VERSION\`](https://www.npmjs.com/package/@youversion/platform-react-native-expo-core/v/$VERSION)"
    echo "- npm: [\`@youversion/platform-react-native-expo-ui@$VERSION\`](https://www.npmjs.com/package/@youversion/platform-react-native-expo-ui/v/$VERSION)"
  } >> "$GITHUB_STEP_SUMMARY"
fi

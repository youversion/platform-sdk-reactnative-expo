#!/usr/bin/env bash
# Restore packages/core/src/version.ts to SDK_VERSION = "Dev" on main as
# the follow-up commit Y after the release commit X has been pushed and
# tagged.
#
# The release tag is NOT moved — it stays at X (which is on main), so
# `git tag --merged main` on the next release run can still discover this
# release as the previous-release base via Y → X ancestry.
#
# Topology after this script runs:
#
#   main:  ... ─ X (SDK_VERSION="$VERSION", package.json#version="$VERSION")   ← TAG $VERSION
#                     ↓
#                     Y (SDK_VERSION="Dev"; package.jsons unchanged)           ← main HEAD
#
# Why this exists
# - Between releases, dev/CI builds should report SDK_VERSION="Dev" so
#   telemetry doesn't show a stale released version.
# - We don't reset package.json#version. npm consumers fetch the published
#   tarball, not main; leaving the manifest at the released version on main
#   is a no-op for consumers and avoids breaking local pnpm tooling.
# - We want the tag reachable from main so the previous-release base
#   discovery on the next release works without special casing.
#
# Pre-conditions
# - HEAD is X, or in release.sh resume mode (where main diverged after X
#   was pushed) a descendant of X — i.e. tag $VERSION is reachable from HEAD.
# - SDK_VERSION at HEAD reads "$VERSION" (stamp-version.sh ran in prepare).
# - Tag $VERSION exists locally and on origin, reachable from HEAD.
#
# Post-conditions on success
# - main HEAD = Y, with packages/core/src/version.ts reading SDK_VERSION="Dev".
# - Tag $VERSION = X (unchanged, still reachable from main).
# - Working tree clean.
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Error: version parameter is required" >&2
  echo "Usage: $0 <semver>" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

VERSION_TS_FILE="packages/core/src/version.ts"

# --- Already-restored fast path -----------------------------------------
# In release.sh resume mode this script may be invoked after a previous
# run already created Y and pushed it. Detect that exact state and
# exit 0 — the strict pre-flights below would otherwise refuse to proceed
# because HEAD's SDK_VERSION reads "Dev", not "$VERSION".
#
# Required state to recognize "Y already present":
#   - HEAD's version.ts reads SDK_VERSION="Dev"
#   - Tag $VERSION is reachable from HEAD (ancestor-or-equal)
#   - Tag $VERSION's tree has SDK_VERSION reading "$VERSION"
#
# Ancestor check (not strict HEAD~1 equality) covers the diverged-main
# topology where Y is on top of unrelated commits after X.
if grep -qF 'export const SDK_VERSION = "Dev"' "$VERSION_TS_FILE"; then
  TAG_SHA_IDEMP=$(git rev-parse "refs/tags/$VERSION^{}" 2>/dev/null || echo "")
  HEAD_SHA_IDEMP=$(git rev-parse HEAD 2>/dev/null || echo "")
  if [ -n "$TAG_SHA_IDEMP" ] && [ -n "$HEAD_SHA_IDEMP" ] && \
     git merge-base --is-ancestor "$TAG_SHA_IDEMP" "$HEAD_SHA_IDEMP" 2>/dev/null; then
    TAG_LINE_IDEMP=$(git show "refs/tags/$VERSION:$VERSION_TS_FILE" 2>/dev/null \
      | grep 'SDK_VERSION' | head -1 || echo "")
    if echo "$TAG_LINE_IDEMP" | grep -qF "export const SDK_VERSION = \"$VERSION\""; then
      echo "✓ Dev-restore commit Y for $VERSION already present at HEAD — nothing to do."
      exit 0
    fi
  fi
fi

# --- Pre-flight assertions ----------------------------------------------

# 1. SDK_VERSION at HEAD must read $VERSION. If not, stamp-version.sh
#    didn't run before this, or HEAD is the wrong commit.
EXPECTED_LINE="export const SDK_VERSION = \"$VERSION\""
if ! grep -qF "$EXPECTED_LINE" "$VERSION_TS_FILE"; then
  echo "❌ $VERSION_TS_FILE at HEAD does not read \"$VERSION\"." >&2
  echo "   Found: $(grep 'SDK_VERSION' "$VERSION_TS_FILE" | head -1)" >&2
  echo "   Expected stamp-version.sh $VERSION to have run before this script." >&2
  exit 1
fi

# 2. Tag $VERSION must exist and be reachable from HEAD. Use ^{} so
#    annotated tags resolve to their target commit.
TAG_SHA=$(git rev-parse "refs/tags/$VERSION^{}" 2>/dev/null || echo "")
HEAD_SHA=$(git rev-parse HEAD)
if [ -z "$TAG_SHA" ]; then
  echo "❌ Tag $VERSION does not exist locally." >&2
  echo "   release.sh should have created it before invoking this script." >&2
  exit 1
fi
if ! git merge-base --is-ancestor "$TAG_SHA" "$HEAD_SHA"; then
  echo "❌ Tag $VERSION at $TAG_SHA is not reachable from HEAD ($HEAD_SHA)." >&2
  echo "   Aborting before pushing Dev-restore — tag and main would end up disjoint." >&2
  exit 1
fi

# --- Restore + commit Y --------------------------------------------------
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/export const SDK_VERSION = \"[^\"]*\"/export const SDK_VERSION = \"Dev\"/" "$VERSION_TS_FILE"
else
  sed -i "s/export const SDK_VERSION = \"[^\"]*\"/export const SDK_VERSION = \"Dev\"/" "$VERSION_TS_FILE"
fi

if ! grep -qF 'export const SDK_VERSION = "Dev"' "$VERSION_TS_FILE"; then
  echo "❌ Failed to restore SDK_VERSION=\"Dev\" in $VERSION_TS_FILE." >&2
  exit 1
fi

git add "$VERSION_TS_FILE"
git commit -m "chore(release): restore SDK_VERSION to Dev on main after $VERSION [skip ci]"

echo "✓ Dev-restore commit Y created (SDK_VERSION=\"Dev\")."
echo "  Pushing to origin/main..."
git push origin HEAD:main
echo "✓ Dev-restore commit Y pushed."

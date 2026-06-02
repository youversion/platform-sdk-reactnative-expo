#!/usr/bin/env bash
# Publish both workspace packages to npm at $VERSION, in dependency order
# (core → ui), with per-package idempotency + bounded retry on transient
# failures.
#
# Called by scripts/release.sh after the tag has been pushed. Idempotent:
# safe to re-run on the same $VERSION after any partial failure mid-publish.
#
# Per-package flow:
#   1. Pre-check: `npm view <pkg>@<version>` — if present on the registry,
#      skip the publish entirely.
#   2. Attempt `pnpm publish` up to MAX_ATTEMPTS times with backoff.
#      We use pnpm (not raw npm) so `workspace:*` deps in ui get rewritten
#      to the actual core version in the published tarball.
#   3. On non-zero exit, classify the failure:
#        - transient (network, timeout, 5xx, provenance) → retry
#        - hard (auth, validation, OTP) → abort the whole script
#      Always re-check `npm view` after a non-zero exit: if the version is
#      now on the registry, the publish actually succeeded mid-flight
#      (the AC's `EPUBLISHCONFLICT`-after-success class). Treat as success.
#
# Usage:
#   VERSION=1.2.3 [DIST_TAG=latest] [DRY_RUN=0] bash scripts/publish-npm.sh
set -euo pipefail

VERSION="${VERSION:-${1:-}}"
DIST_TAG="${DIST_TAG:-latest}"
DRY_RUN="${DRY_RUN:-0}"
# PROVENANCE=1 appends `--provenance` to pnpm publish so npm generates a
# signed attestation linking the tarball to this GitHub Actions run. Set
# by release.yml / manual-npm-publish.yml when `id-token: write` is
# granted. Off by default so local dry-runs and NPM_TOKEN-only setups
# don't fail on the missing OIDC env vars.
PROVENANCE="${PROVENANCE:-0}"

if [ -z "$VERSION" ]; then
  echo "❌ VERSION env var is required" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

# Order matters — `ui` depends on `core` via workspace:*, so `core` has
# to be on the registry before `ui` gets published; otherwise the rewritten
# `workspace:*` references in `ui`'s tarball point at a version that doesn't
# yet exist.
PACKAGES=(
  "packages/core:@youversion/platform-react-native-expo-core"
  "packages/ui:@youversion/platform-react-native-expo-ui"
)

MAX_ATTEMPTS=2
BACKOFF_SECONDS=30

# Patterns that mean "the registry is having a bad day; retry."
TRANSIENT_REGEX='(ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENETUNREACH|ENOTFOUND|Could not resolve host|RPC failed|temporarily unavailable|503 Service Unavailable|502 Bad Gateway|504 Gateway Time-out|HTTP 5[0-9][0-9]|fetch failed|attestation|provenance)'

# Patterns that mean "this will never succeed without human intervention."
HARD_REGEX='(E401|EAUTH|EUNAUTHORIZED|E403|EFORBIDDEN|EOTP|need a one-time password|need a CAPTCHA|E404|EBADENGINE|EINVALIDTAGNAME|EINVALIDPACKAGENAME|missing required field|invalid package|EPRIVATE|This package has been marked as private)'

# Pattern that means "the version is already on the registry" — treat as
# success-after-the-fact when seen on a non-zero exit after we tried to
# publish, per the AC.
ALREADY_PUBLISHED_REGEX='(EPUBLISHCONFLICT|You cannot publish over the previously published versions|version already exists|409 Conflict)'

published_to_registry() {
  local pkg_name="$1"
  # `npm view <pkg>@<version> version` prints the version if present and
  # nothing (with non-zero exit) if not. We swallow the non-zero exit
  # because "not found" is a valid success path here.
  local found
  found=$(npm view "${pkg_name}@${VERSION}" version 2>/dev/null || true)
  [ "$found" = "$VERSION" ]
}

publish_one() {
  local pkg_dir="$1"
  local pkg_name="$2"

  echo
  echo "── $pkg_name @ $VERSION ──"

  if published_to_registry "$pkg_name"; then
    echo "  ✓ ${pkg_name}@${VERSION} is already on the registry — skipping publish."
    return 0
  fi

  local provenance_flag=""
  if [ "$PROVENANCE" = "1" ]; then
    provenance_flag="--provenance"
  fi

  if [ "$DRY_RUN" = "1" ]; then
    echo "  🧪 DRY_RUN=1 — would run: pnpm --filter $pkg_name publish --tag $DIST_TAG --access public --no-git-checks $provenance_flag"
    return 0
  fi

  local attempt=0
  while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
    attempt=$((attempt + 1))
    echo "  attempt $attempt/$MAX_ATTEMPTS"

    local out
    out=$(mktemp)
    set +e
    # `--no-git-checks` because release.sh already validates the working
    # tree and we run from a detached tag head on resume.
    # `--access public` is required for the first publish of a scoped
    # package; a no-op after that.
    # `--provenance` (when PROVENANCE=1) generates a signed attestation
    # linking the tarball to this CI run. Needs `id-token: write` granted
    # by the workflow, plus npm registry support — release.yml sets both.
    pnpm --filter "$pkg_name" publish \
      --tag "$DIST_TAG" \
      --access public \
      --no-git-checks \
      $provenance_flag \
      > "$out" 2>&1
    local rc=$?
    set -e

    cat "$out"

    if [ "$rc" -eq 0 ]; then
      echo "  ✓ ${pkg_name}@${VERSION} published (dist-tag: $DIST_TAG)."
      rm -f "$out"
      return 0
    fi

    # Post-failure registry check — covers the case where the registry
    # actually accepted the publish but the response timed out (the AC's
    # EPUBLISHCONFLICT-after-success class).
    if published_to_registry "$pkg_name"; then
      echo "  ✓ ${pkg_name}@${VERSION} is on the registry despite non-zero exit — treating as success."
      rm -f "$out"
      return 0
    fi

    if grep -qE "$HARD_REGEX" "$out"; then
      echo "❌ Hard-fail signature in publish output — aborting." >&2
      rm -f "$out"
      return $rc
    fi

    if grep -qE "$ALREADY_PUBLISHED_REGEX" "$out"; then
      # The npm error says "already published" but npm view didn't see it
      # above. This is rare and means the registry is in an inconsistent
      # transient state. Re-check once more after a backoff.
      echo "  ⚠️  Already-published signature seen but registry didn't confirm — backing off and re-checking."
      sleep "$BACKOFF_SECONDS"
      if published_to_registry "$pkg_name"; then
        echo "  ✓ ${pkg_name}@${VERSION} now confirmed on the registry — treating as success."
        rm -f "$out"
        return 0
      fi
      # Fall through to transient-retry path otherwise.
    fi

    if grep -qE "$TRANSIENT_REGEX" "$out" || [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
        echo "  ⚠️  Transient or unclassified failure; sleeping ${BACKOFF_SECONDS}s then retrying..."
        sleep "$BACKOFF_SECONDS"
        rm -f "$out"
        continue
      fi
    fi

    # Exhausted attempts.
    echo "❌ Publish of ${pkg_name}@${VERSION} failed after $attempt attempt(s)." >&2
    rm -f "$out"
    return $rc
  done

  return 1
}

echo "Publishing both workspace packages at version $VERSION (dist-tag: $DIST_TAG)..."

for entry in "${PACKAGES[@]}"; do
  pkg_dir="${entry%%:*}"
  pkg_name="${entry##*:}"
  publish_one "$pkg_dir" "$pkg_name"
done

echo
echo "✓ All workspace packages published at $VERSION."

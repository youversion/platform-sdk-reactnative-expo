#!/usr/bin/env bash
# Stamp a version string into:
#   - packages/core/package.json#version
#   - packages/ui/package.json#version
#   - packages/core/src/version.ts (SDK_VERSION constant)
#
# Idempotent: works whether the targets currently read "Dev", a stale
# released version, or the same version we're stamping. Run from any cwd;
# the script resolves paths relative to its own location.
#
# Designed to be portable to other YouVersion SDKs that ship multiple
# workspace packages: the only project-specific bits are PACKAGES and
# VERSION_TS_FILE below.
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Error: version parameter is required" >&2
  echo "Usage: $0 <semver>" >&2
  exit 1
fi

# Validate the input looks like semver so we don't write garbage into
# either manifest. release-validate.mjs does the full check; this is a
# belt-and-suspenders guard for the case where stamp-version.sh is
# invoked directly (e.g. from a runbook step).
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: '$VERSION' is not a valid semver string" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

PACKAGES=(packages/core packages/ui)
VERSION_TS_FILE="packages/core/src/version.ts"

echo "Stamping version $VERSION across the workspace..."

for pkg in "${PACKAGES[@]}"; do
  manifest="$pkg/package.json"
  if [ ! -f "$manifest" ]; then
    echo "Error: $manifest not found" >&2
    exit 1
  fi
  # `npm pkg set` parses + writes JSON without dragging in jq.
  npm pkg set --workspaces=false --prefix "$pkg" version="$VERSION" > /dev/null
  echo "  ✓ $manifest now reads version: $VERSION"
done

if [ ! -f "$VERSION_TS_FILE" ]; then
  echo "Error: $VERSION_TS_FILE not found" >&2
  exit 1
fi

# Replace the literal between quotes on the SDK_VERSION line. Tolerates
# the file currently reading "Dev" or any prior semver.
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/export const SDK_VERSION = \"[^\"]*\"/export const SDK_VERSION = \"$VERSION\"/" "$VERSION_TS_FILE"
else
  sed -i "s/export const SDK_VERSION = \"[^\"]*\"/export const SDK_VERSION = \"$VERSION\"/" "$VERSION_TS_FILE"
fi

if ! grep -qF "export const SDK_VERSION = \"$VERSION\"" "$VERSION_TS_FILE"; then
  echo "Error: failed to stamp SDK_VERSION into $VERSION_TS_FILE" >&2
  exit 1
fi
echo "  ✓ $VERSION_TS_FILE now reads SDK_VERSION = \"$VERSION\""

echo "Version stamp complete."

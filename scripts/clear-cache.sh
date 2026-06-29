#!/usr/bin/env bash
#
# Clear all React Native / Expo / Metro caches for this monorepo, then reinstall.
# Adapted for pnpm + Turborepo from:
# https://docs.expo.dev/troubleshooting/clear-cache-macos-linux/#expo-cli-and-npm
#
# Use when Metro serves stale modules, after native config changes (e.g. app.json
# scheme), or when the dev client behaves inconsistently.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ Resetting watchman"
watchman watch-del-all 2>/dev/null || true

echo "→ Removing node_modules (root + workspaces)"
rm -rf node_modules apps/*/node_modules packages/*/node_modules

echo "→ Pruning pnpm store"
pnpm store prune || true

echo "→ Clearing Metro / Haste temp caches"
rm -rf "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-* "${TMPDIR:-/tmp}"/react-* 2>/dev/null || true

echo "→ Reinstalling dependencies"
pnpm install

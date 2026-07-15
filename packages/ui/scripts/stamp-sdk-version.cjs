'use strict'

/**
 * Publish-time SDK version stamp.
 *
 * `src/lib/sdk-version.ts` keeps `SDK_VERSION` as the `'Dev'` sentinel so builds
 * that run from source (local dev, the example app, YouVersion-internal usage)
 * are identifiable as non-published traffic in the data lake. On publish we need
 * npm consumers to report the real version instead.
 *
 * This file is wired as the LAST step of the UI package `prepublishOnly`
 * (`expo-module prepublishOnly && node scripts/stamp-sdk-version.cjs`). By then
 * `expo-module build` has produced `build/`, so we rewrite the `'Dev'` literal
 * in the COMPILED `build/lib/sdk-version.js` only — source is never touched, so
 * dev keeps reporting `'Dev'`.
 *
 * The pure transform is exported for unit testing; the file-IO block below runs
 * only when the script is executed directly (`require.main === module`), so
 * requiring it from a test does not touch the filesystem.
 *
 * See docs/adr/0012-sdk-version-stamp-on-publish.md.
 */

// The exact assignment text as it appears in the compiled build output. Kept
// as a fuller string (not just `Dev`) so incidental mentions of the word in
// comments cannot collide with the anchor count.
const SENTINEL = "SDK_VERSION = 'Dev'"

/**
 * Replace the `'Dev'` sentinel with `version`. Throws rather than ever silently
 * shipping `'Dev'` (or a malformed literal) to production telemetry.
 *
 * @param {string} source  Contents of the compiled build/lib/sdk-version.js
 * @param {string} version The package version to stamp in
 * @returns {string} The stamped source
 */
function stampSdkVersion(source, version) {
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error('stampSdkVersion: a non-empty version string is required')
  }
  // A version containing a quote, backslash, or newline would break the string
  // literal (or worse, inject code). Semver never contains these.
  if (/['"\n\\]/.test(version)) {
    throw new Error(`stampSdkVersion: refusing to stamp unsafe version ${JSON.stringify(version)}`)
  }

  const occurrences = source.split(SENTINEL).length - 1
  if (occurrences !== 1) {
    throw new Error(
      `stampSdkVersion: expected exactly one "${SENTINEL}" anchor in the build ` +
        `output, found ${occurrences}. The sentinel in src/lib/sdk-version.ts ` +
        'likely changed — update SENTINEL here to match.',
    )
  }

  // Function replacer so a `$` in the version is never treated as a special
  // replacement pattern.
  const stamped = source.replace(SENTINEL, () => `SDK_VERSION = '${version}'`)

  if (stamped.includes(SENTINEL)) {
    throw new Error("stampSdkVersion: 'Dev' sentinel still present after stamping")
  }
  if (!stamped.includes(`SDK_VERSION = '${version}'`)) {
    throw new Error('stampSdkVersion: stamped version missing after replace')
  }
  return stamped
}

module.exports = { stampSdkVersion, SENTINEL }

if (require.main === module) {
  const fs = require('node:fs')
  const path = require('node:path')

  const pkgRoot = path.resolve(__dirname, '..')
  const target = path.join(pkgRoot, 'build', 'lib', 'sdk-version.js')
  const { version } = require(path.join(pkgRoot, 'package.json'))

  const stamped = stampSdkVersion(fs.readFileSync(target, 'utf8'), version)
  fs.writeFileSync(target, stamped)

  console.log(`stamp-sdk-version: wrote SDK_VERSION = '${version}' to build/lib/sdk-version.js`)
}

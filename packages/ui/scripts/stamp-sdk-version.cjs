'use strict'

/**
 * Publish-time build-channel stamp.
 *
 * `src/lib/sdk-version.ts` derives the `x-yvp-sdk` value from `package.json`
 * and appends `-dev` unless `IS_PUBLISH_BUILD` is true, so builds that run from
 * source (local dev, the example app, YouVersion-internal usage) are
 * identifiable as non-published traffic in the data lake. On publish we need npm
 * consumers to report the bare version instead.
 *
 * This file is wired as the LAST step of the UI package `prepublishOnly`
 * (`expo-module prepublishOnly && node scripts/stamp-sdk-version.cjs`). By then
 * `expo-module build` has produced `build/`, so we flip the flag in the COMPILED
 * `build/lib/sdk-version.js` only — source is never touched, so dev keeps
 * reporting `-dev`.
 *
 * The pure transform is exported for unit testing; the file-IO block below runs
 * only when the script is executed directly (`require.main === module`), so
 * requiring it from a test does not touch the filesystem.
 *
 * See docs/adr/0012-sdk-version-stamp-on-publish.md.
 */

// The exact assignment text as it appears in the compiled build output.
const SENTINEL = 'IS_PUBLISH_BUILD = false'
const STAMPED = 'IS_PUBLISH_BUILD = true'

/**
 * Flip the build-channel flag from `false` to `true`. Throws rather than ever
 * silently shipping `-dev`-tagged telemetry to partners.
 *
 * Note this asserts the POSITIVE stamp rather than checking that `-dev` is
 * absent. A `-dev` match would false-positive: the compiled ternary keeps the
 * suffix in its (dead) else branch in every build, published or not. And
 * checking only that `= false` is gone would fail OPEN — if tooling ever folded
 * or minified the constant away, neither literal would survive and a dev build
 * would sail through. Requiring the stamp fails closed instead: a build whose
 * channel cannot be confirmed aborts the publish.
 *
 * @param {string} source Contents of the compiled build/lib/sdk-version.js
 * @returns {string} The stamped source
 */
function stampPublishBuild(source) {
  const occurrences = source.split(SENTINEL).length - 1
  if (occurrences !== 1) {
    throw new Error(
      `stampPublishBuild: expected exactly one "${SENTINEL}" anchor in the build ` +
        `output, found ${occurrences}. The flag in src/lib/sdk-version.ts likely ` +
        'changed — update SENTINEL here to match.',
    )
  }

  const stamped = source.replace(SENTINEL, STAMPED)

  if (!stamped.includes(STAMPED)) {
    throw new Error(`stampPublishBuild: "${STAMPED}" missing after replace`)
  }
  if (stamped.includes(SENTINEL)) {
    throw new Error(`stampPublishBuild: "${SENTINEL}" still present after stamping`)
  }
  return stamped
}

module.exports = { stampPublishBuild, SENTINEL, STAMPED }

if (require.main === module) {
  const fs = require('node:fs')
  const path = require('node:path')

  const pkgRoot = path.resolve(__dirname, '..')
  const target = path.join(pkgRoot, 'build', 'lib', 'sdk-version.js')
  const { version } = require(path.join(pkgRoot, 'package.json'))

  const stamped = stampPublishBuild(fs.readFileSync(target, 'utf8'))
  fs.writeFileSync(target, stamped)

  console.log(
    `stamp-sdk-version: stamped build/lib/sdk-version.js as a publish build ` +
      `(x-yvp-sdk will report ReactNativeSDK=${version})`,
  )
}

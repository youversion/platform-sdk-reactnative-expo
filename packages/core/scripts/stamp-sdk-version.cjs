'use strict'

// Publish-time stamp: flips `IS_PUBLISH_BUILD` in the compiled build/sdk-version.js
// as the last `prepublishOnly` step. Fails closed — see ADR 0012.

const SENTINEL = 'IS_PUBLISH_BUILD = false'
const STAMPED = 'IS_PUBLISH_BUILD = true'

// Exactly one anchor, positive stamp asserted — an unconfirmable build aborts
// the publish (ADR 0012 records why matching `-dev` would false-positive).
function stampPublishBuild(source) {
  const occurrences = source.split(SENTINEL).length - 1
  if (occurrences !== 1) {
    throw new Error(
      `stampPublishBuild: expected exactly one "${SENTINEL}" anchor in the build ` +
        `output, found ${occurrences}. The flag in src/sdk-version.ts likely ` +
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
  const target = path.join(pkgRoot, 'build', 'sdk-version.js')
  const { version } = require(path.join(pkgRoot, 'package.json'))

  const stamped = stampPublishBuild(fs.readFileSync(target, 'utf8'))
  fs.writeFileSync(target, stamped)

  console.log(
    `stamp-sdk-version: stamped build/sdk-version.js as a publish build ` +
      `(x-yvp-sdk will report ReactNativeSDK=${version})`,
  )
}

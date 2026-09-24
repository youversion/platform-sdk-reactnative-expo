import assert from 'node:assert/strict'
import { test } from 'node:test'

import { stripBookkeeping } from './build-root-changelog.mjs'

const CORE = '@youversion/platform-react-native-expo-core'

test('drops the fixed group version bookkeeping Changesets writes', () => {
  assert.equal(stripBookkeeping('- Updated dependencies [80d3718]'), null)
  assert.equal(stripBookkeeping(`- Updated dependencies [3dfe296]\n  - ${CORE}@1.5.0`), null)
  assert.equal(stripBookkeeping(`- ${CORE}@1.6.0`), null)
})

test('keeps a release note that only reads like bookkeeping', () => {
  // The filter used to match the bare `- Updated dependencies` prefix, so this whole entry
  // disappeared from the root changelog.
  const note = '- Updated dependencies to address CVE-1234.'
  assert.equal(stripBookkeeping(note), note)
})

test('keeps a bump for a package outside the fixed group', () => {
  // Only the group's own packages share a version, so only their bumps are duplication. A
  // third-party bump is something the consumer is being told about.
  const note = '- Bumped the HTTP client.\n  - @vendor/client@2.0.0'
  assert.equal(stripBookkeeping(note), note)
  assert.equal(stripBookkeeping('- @vendor/client@2.0.0'), '- @vendor/client@2.0.0')
})

test('strips a trailing group bump without eating the note above it', () => {
  assert.equal(
    stripBookkeeping(`- Added a native chapter picker.\n  - ${CORE}@1.6.0`),
    '- Added a native chapter picker.',
  )
})

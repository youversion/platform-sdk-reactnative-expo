import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseEntries, stripBookkeeping } from './build-root-changelog.mjs'

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

test('keeps a subheading that opens a section before any bullet', () => {
  // Every other subheading in these changelogs follows a bullet and rides along
  // as that entry's trailing lines. The first one under a `###` has nothing to
  // ride, and used to be dropped outright.
  const groups = parseEntries([
    '### Added',
    '',
    '**Scripture display**',
    '',
    '- `BibleTextView` renders a verse',
  ])

  assert.deepEqual(
    groups.map((g) => g.text),
    ['**Scripture display**', '- `BibleTextView` renders a verse'],
  )
  assert.ok(groups.every((g) => g.kind === 'Added'))
})

test('a subheading after a bullet stays with the entry it trails', () => {
  const groups = parseEntries([
    '### Added',
    '',
    '- first thing',
    '',
    '**Bible reader**',
    '',
    '- second thing',
  ])

  assert.deepEqual(
    groups.map((g) => g.text),
    ['- first thing\n\n**Bible reader**', '- second thing'],
  )
})

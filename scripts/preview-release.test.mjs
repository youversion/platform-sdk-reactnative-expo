import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import readChangesets from '@changesets/read'

import { isChangesetPath, isLegacyChangesetPath } from './changeset-eligibility.mjs'

// Derive the expectation from the real reader rather than a second copy of its rule. A
// hand-written list would keep passing if Changesets changed what it accepts, which is
// exactly how `breaking-README.md` slipped through: the detector excluded every
// `*README.md` while Changesets excludes only the exact basename.
test('eligibility matches what Changesets actually reads', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'changeset-eligibility-'))
  mkdirSync(join(dir, '.changeset'))
  const names = [
    'README.md',
    'readme.md',
    'breaking-README.md',
    'my-README.md',
    'ordinary-change.md',
    '.hidden.md',
    'notes.txt',
  ]
  for (const name of names) {
    writeFileSync(join(dir, '.changeset', name), `---\n'@scope/pkg': major\n---\n\nbreaking\n`)
  }

  const read = await readChangesets(dir)
  const readIds = new Set(read.map((c) => c.id))

  for (const name of names) {
    const changesetsReadsIt = readIds.has(name.replace(/\.md$/, ''))
    assert.equal(
      isChangesetPath(`.changeset/${name}`),
      changesetsReadsIt,
      `${name}: detector and Changesets disagree`,
    )
  }
})

test('a path Changesets never reads is not counted', () => {
  assert.equal(isChangesetPath('.changeset/nested/deep.md'), false)
  assert.equal(isChangesetPath('.changeset/config.json'), false)
  assert.equal(isChangesetPath('packages/ui/CHANGELOG.md'), false)
})

// @changesets/read still treats a directory under `.changeset` as a changeset, reading its
// `changes.md` and `changes.json`. The flat-file rule rejects both, so without this the
// detector reports no major while Changesets computes one.
test('the legacy directory format is recognised, because Changesets still reads it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'changeset-legacy-'))
  mkdirSync(join(dir, '.changeset', 'legacy-major'), { recursive: true })
  writeFileSync(join(dir, '.changeset', 'legacy-major', 'changes.md'), 'a breaking change\n')
  writeFileSync(
    join(dir, '.changeset', 'legacy-major', 'changes.json'),
    JSON.stringify({ releases: [{ name: '@scope/pkg', type: 'major' }], dependents: [] }),
  )

  const read = await readChangesets(dir)
  assert.equal(read.length, 1, 'Changesets should still read the legacy directory')
  assert.equal(read[0].releases[0].type, 'major')

  // The flat rule does not cover it, so the legacy rule has to, or it ships unsigned.
  assert.equal(isChangesetPath('.changeset/legacy-major/changes.md'), false)
  assert.equal(isLegacyChangesetPath('.changeset/legacy-major/changes.md'), true)
  assert.equal(isLegacyChangesetPath('.changeset/legacy-major/changes.json'), true)
})

test('an unrelated nested file is not mistaken for a legacy changeset', () => {
  assert.equal(isLegacyChangesetPath('.changeset/notes/scratch.md'), false)
  assert.equal(isLegacyChangesetPath('.changeset/a/b/changes.md'), false)
})

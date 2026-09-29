/**
 * Which repo-relative paths Changesets will actually read as changesets.
 *
 * Its own module so the release detector and the test suite share one definition, and so
 * the signoff workflow can restore it from `main` alongside the detector. A PR-supplied
 * copy of this rule would let a branch hide its own major.
 *
 * Mirrors @changesets/read: it reads `.changeset` itself and keeps a file when the name
 * does not start with `.`, ends with `.md`, and is not literally `README.md`
 * (case-insensitive). Anything looser hides a real major. A suffix test on README drops
 * `breaking-README.md`, which Changesets counts; accepting a nested path counts a file it
 * never reads.
 */
export function isChangesetPath(file) {
  if (!file.startsWith('.changeset/')) return false
  const name = file.slice('.changeset/'.length)
  if (name.includes('/')) return false
  return !name.startsWith('.') && name.endsWith('.md') && !/^README\.md$/i.test(name)
}

/**
 * Does this path belong to a legacy directory-format changeset?
 *
 * @changesets/read still treats every directory under `.changeset` as a changeset, reading
 * its `changes.md` and `changes.json`. The flat-file rule above rejects both, so a major
 * declared this way is invisible to the detector while Changesets still ships it.
 *
 * Nothing in this repo uses the format, so the detector fails closed on it rather than
 * learning to parse it: a release that declares its major this way asks for a signoff.
 */
export function isLegacyChangesetPath(file) {
  if (!file.startsWith('.changeset/')) return false
  const rest = file.slice('.changeset/'.length)
  const [dir, ...tail] = rest.split('/')
  // No dot exclusion: `getOldChangesets` filters only on `isDirectory()`, so Changesets
  // reads `.changeset/.breaking/` exactly like any other directory. Mirroring the
  // flat-file dotfile rule here would let a major hide in a dot-named directory.
  if (tail.length !== 1 || dir === '') return false
  return tail[0] === 'changes.md' || tail[0] === 'changes.json'
}

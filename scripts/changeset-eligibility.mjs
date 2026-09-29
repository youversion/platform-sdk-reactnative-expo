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

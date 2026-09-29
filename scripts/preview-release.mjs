#!/usr/bin/env node
// Compute the pending release for a PR and report whether this PR is the one
// introducing a breaking change.
//
// The Swift SDK's script of the same name calls `@semantic-release/commit-analyzer`,
// because there commit footers drive the version. This repo does not work that way:
// the bump level is declared in `.changeset/*.md` frontmatter and Changesets computes
// the version. See docs/release-hardening-decisions.md (Decision 1), which records
// that ruling.
//
// Two questions, deliberately kept separate:
//
//   is_major         - would the pending release be a major? (from `changeset status`,
//                      which is authoritative and accounts for the `fixed` group)
//   introduced_major - did *this PR* add a changeset declaring `major`? Only this gates.
//                      Without it, a major already pending on main would block every
//                      unrelated PR until the release went out.
//
// Output (stdout): one line of JSON:
//   { current, next, release_type, is_major, introduced_major, packages, added_changesets }
//
// Usage:
//   node scripts/preview-release.mjs --base <sha> [--head <sha>]
import { execFileSync } from 'node:child_process'
import { getPackages } from '@manypkg/get-packages'
import parseChangeset from '@changesets/parse'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isChangesetPath, isLegacyChangesetPath } from './changeset-eligibility.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i]?.startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
if (!args.base) {
  console.error('usage: preview-release.mjs --base <sha> [--head <sha>]')
  process.exit(2)
}
const head = args.head ?? 'HEAD'

const git = (...a) =>
  execFileSync('git', a, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

/**
 * `changeset status` writes its JSON relative to the repo root, not the cwd, and prints
 * a `/dev/tty` warning on non-interactive runners. Write to a temp dir inside the repo
 * and read it back rather than parsing stdout.
 */
function changesetStatus() {
  const dir = mkdtempSync(join(REPO_ROOT, '.changeset-status-'))
  const rel = join(relative(REPO_ROOT, dir), 'status.json')
  try {
    try {
      execFileSync('pnpm', ['exec', 'changeset', 'status', `--output=${rel}`], {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      // Swallowing this cost a CI round-trip: `changeset status` resolves the configured
      // baseBranch as a LOCAL ref, and a PR checkout has only origin/main, so it failed
      // with a message nobody could see. Changesets writes its diagnostics to stdout and
      // an unrelated /dev/tty warning to stderr on non-interactive runners, so include
      // both and let the reader judge.
      const detail = [error.stdout, error.stderr]
        .map((s) => s?.toString().trim())
        .filter(Boolean)
        .join('\n')
      throw new Error(`changeset status failed${detail ? `:\n${detail}` : ''}`)
    }
    return JSON.parse(readFileSync(join(dir, 'status.json'), 'utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Levels declared at one ref, or null when the file does not exist there.
 *
 * Parsed with Changesets' own parser rather than by hand. A partial YAML reader diverges on
 * flow mappings, block scalars, anchors and tags, and every divergence is the same failure:
 * Changesets computes a major that this script reports as no major, and the gate opens.
 *
 * Only a genuine absence returns null. A read that fails for any other reason throws, because
 * treating it as "no levels" would under-report a major.
 */
const LEVEL_RANK = { patch: 0, minor: 1, major: 2 }

/**
 * Fold a Changesets `releases` array into one level per package.
 *
 * Highest wins, because that is what Changesets does. Assigning as we iterate would keep
 * the last entry instead, so `[{pkg, major}, {pkg, minor}]` would read as a minor and the
 * major would never reach the gate.
 */
function foldReleases(releases) {
  const levels = {}
  for (const release of releases ?? []) {
    const current = levels[release.name]
    if (current === undefined || LEVEL_RANK[release.type] > LEVEL_RANK[current]) {
      levels[release.name] = release.type
    }
  }
  return levels
}

function existsAtRef(ref, file) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${file}`], { cwd: REPO_ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * What Changesets would make of a legacy directory at one ref.
 *
 * It reads `changes.md` and `changes.json` together, so a directory missing either is not a
 * changeset to it at all. That matters as a transition: adding the missing summary to a
 * directory that already declared a major makes that major visible for the first time.
 *
 * `levels: 'unreadable'` when the JSON will not parse, which the caller fails closed on.
 */
function legacyDirState(ref, dir) {
  if (!existsAtRef(ref, `${dir}/changes.md`) || !existsAtRef(ref, `${dir}/changes.json`)) {
    return { readable: false, levels: {} }
  }
  try {
    return {
      readable: true,
      levels: foldReleases(JSON.parse(git('show', `${ref}:${dir}/changes.json`)).releases),
    }
  } catch {
    return { readable: true, levels: 'unreadable' }
  }
}

function levelsAtRef(ref, file) {
  const spec = `${ref}:${file}`
  try {
    execFileSync('git', ['cat-file', '-e', spec], { cwd: REPO_ROOT, stdio: 'ignore' })
  } catch {
    return null
  }
  return foldReleases(parseChangeset(git('show', spec)).releases)
}

/**
 * Majors this PR introduces, per package.
 *
 * Renames are followed (`-M`): renaming a changeset while raising it to major would otherwise
 * report as `R` and be skipped entirely.
 *
 * The base comparison is per package, not per file. A changeset already declaring one package
 * major must not mask a *different* package being raised to major in the same file.
 *
 * `-z` because git C-quotes unusual paths otherwise, and a quoted path fails the changeset
 * name test and drops out of the scan.
 */
function addedChangesetLevels(base) {
  const raw = execFileSync(
    'git',
    [
      'diff',
      '--name-status',
      '-z',
      '-M',
      // `T` as well as AMR: replacing a changeset with a symlink is a type change, and
      // dropping it here would hide a major that Changesets still reads through the link.
      '--diff-filter=AMRT',
      `${base}..${head}`,
      '--',
      '.changeset',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const fields = raw.split('\0').filter((f) => f !== '')

  // Mirror @changesets/read exactly. It reads the directory itself and keeps a file when
  // it does not start with `.`, ends with `.md`, and is not literally `README.md`
  // (case-insensitive). Anything looser here hides a real major: a suffix test on README
  // drops `breaking-README.md`, which Changesets counts, and allowing a nested path counts
  // a file Changesets never reads.
  const isChangeset = (f) => isChangesetPath(f)

  /** A symlinked changeset is followed by Changesets but unreadable as a blob here. */
  const isSymlink = (ref, path) => {
    const entry = execFileSync('git', ['ls-tree', '-z', ref, '--', path], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    return entry.startsWith('120000')
  }
  const levels = []
  const touched = []
  // A legacy directory can present two changed files; evaluate it once.
  const seenLegacyDirs = new Set()

  for (let i = 0; i < fields.length; ) {
    const code = fields[i]
    // A rename consumes three fields (status, old, new); add and modify consume two.
    const isRename = code.startsWith('R')
    const basePath = fields[i + 1]
    const headPath = isRename ? fields[i + 2] : fields[i + 1]
    i += isRename ? 3 : 2
    // Changesets reads a legacy directory as a unit: `changes.md` and `changes.json`
    // together, or not at all. Judge the directory rather than the file, so that adding a
    // missing summary to a directory that already declared a major is seen for what it is,
    // a major becoming visible for the first time.
    if (isLegacyChangesetPath(headPath)) {
      touched.push(headPath)
      const dir = headPath.slice(0, headPath.lastIndexOf('/'))
      if (seenLegacyDirs.has(dir)) continue
      seenLegacyDirs.add(dir)

      const headState = legacyDirState(head, dir)
      if (!headState.readable) continue // Changesets cannot read it either
      if (headState.levels === 'unreadable') {
        // Fail closed: a declaration we cannot parse may well be a major.
        for (const pkg of published) {
          levels.push({ file: `${dir}/changes.json`, level: 'major', package: pkg })
        }
        continue
      }
      // Follow a rename: comparing against the new directory name would find nothing at
      // base and read an already-declared major as newly introduced.
      const baseDir = isLegacyChangesetPath(basePath)
        ? basePath.slice(0, basePath.lastIndexOf('/'))
        : dir
      const baseState = legacyDirState(base, baseDir)
      const baseLevels =
        baseState.readable && baseState.levels !== 'unreadable' ? baseState.levels : {}
      for (const [pkg, level] of Object.entries(headState.levels)) {
        if (level !== 'major') continue
        if (baseLevels[pkg] === 'major') continue
        if (!inRelease(pkg)) continue
        levels.push({ file: `${dir}/changes.json`, level, package: pkg })
      }
      continue
    }
    if (!isChangeset(headPath)) continue
    touched.push(headPath)

    // Fail closed rather than guess: Changesets resolves the link and may read a major,
    // while reading the blob here yields the link target's path, not changeset front
    // matter. Treat it as introducing a major so the gate asks for a signoff.
    if (isSymlink(head, headPath)) {
      for (const pkg of published) {
        levels.push({ file: headPath, level: 'major', package: pkg })
      }
      continue
    }

    const headLevels = levelsAtRef(head, headPath) ?? {}
    // Only compare against the old path if Changesets would have read it. Renaming an
    // ignored file such as `.changeset/.hidden.md` onto an eligible name introduces its
    // major for the first time; reading the old path would find that same major and
    // dismiss it as pre-existing.
    const baseLevels = isChangesetPath(basePath) ? levelsAtRef(base, basePath) : null
    for (const [pkg, level] of Object.entries(headLevels)) {
      if (level !== 'major') continue
      if (baseLevels && baseLevels[pkg] === 'major') continue // already breaking before this PR
      if (!inRelease(pkg)) continue // private package, never published, so it cannot break consumers
      levels.push({ file: headPath, level, package: pkg })
    }
  }
  return { added: touched, levels }
}

// Changesets versions every workspace package, including private ones it will never
// publish (apps/example), so an unfiltered release list carries a second unrelated
// version and breaks the one-version check below.
//
// Filter on `private`, the actual publish flag. Deliberately NOT on `fixed`-group
// membership: that is a versioning policy, not a publish flag, so a publishable package
// added outside the group would be silently skipped and a major on it would report
// `introduced_major: false`. Filtering this way keeps such a package in scope, where the
// one-version check below fails loudly instead.
const { packages: workspacePackages } = await getPackages(
  fileURLToPath(new URL('..', import.meta.url)),
)
const published = new Set(
  workspacePackages.filter((p) => !p.packageJson.private).map((p) => p.packageJson.name),
)
const inRelease = (name) => published.has(name)

const status = changesetStatus()
const releases = (status.releases ?? []).filter((r) => inRelease(r.name))
const majors = releases.filter((r) => r.type === 'major')
const versions = [...new Set(releases.map((r) => r.newVersion))]

// The `fixed` group in .changeset/config.json versions both packages in lockstep,
// so a single version string describes the release. If that ever stops being true the
// signoff comment would be ambiguous about which version is being approved, so fail
// loudly rather than pick one.
if (versions.length > 1) {
  console.error(
    `preview-release: expected one version across packages, got ${versions.join(', ')}. ` +
      `The 'fixed' group in .changeset/config.json may have changed.`,
  )
  process.exit(1)
}

const { added, levels } = addedChangesetLevels(args.base)

console.log(
  JSON.stringify({
    current: releases[0]?.oldVersion ?? null,
    next: versions[0] ?? null,
    release_type: majors.length ? 'major' : (releases[0]?.type ?? null),
    is_major: majors.length > 0,
    introduced_major: levels.some((l) => l.level === 'major'),
    packages: releases.map((r) => r.name),
    added_changesets: added,
  }),
)

#!/usr/bin/env node
// Build the repo-root CHANGELOG.md by merging the per-package changelogs Changesets writes.
//
// Swift and Kotlin each ship a root CHANGELOG.md; this repo had only per-package files, so
// there was no single place to see what shipped in a release (YPE-4190).
//
// The two packages are a `fixed` group in .changeset/config.json, so they always share a
// version number and a changeset touching several of them writes the *same* entry into each
// of their changelogs. Copying all three verbatim would therefore triple most entries. This
// merges by version, shows each entry once, and notes which packages it affected.
//
// `Updated dependencies` blocks are dropped: they are the fixed group's internal bookkeeping,
// not something a consumer reading release notes needs.
//
// Run via `pnpm build:root-changelog`; wired into `version-packages` so the Version Packages
// PR carries an up-to-date root changelog.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = join(ROOT, 'packages')

// Read before the filters below, which need the group's package names: a bump line for a
// package outside the group is a note about a real dependency, not our own bookkeeping.
const fixedGroups = JSON.parse(readFileSync(join(ROOT, '.changeset', 'config.json'), 'utf8')).fixed
if (fixedGroups?.length !== 1) {
  throw new Error(
    `Expected exactly one fixed group in .changeset/config.json, found ${fixedGroups?.length ?? 0}.`,
  )
}

/** `## 2.12.1` ... up to the next `## ` */
function versionSections(markdown) {
  const out = []
  const lines = markdown.split('\n')
  let current = null
  for (const line of lines) {
    const m = line.match(/^## (\d+\.\d+\.\d+.*)$/)
    if (m) {
      if (current) out.push(current)
      current = { version: m[1].trim(), body: [] }
      continue
    }
    if (current) current.body.push(line)
  }
  if (current) out.push(current)
  return out
}

/**
 * Split a version body into `{ kind, entries }`, where kind is Major/Minor/Patch and each
 * entry keeps its continuation lines (Changesets indents them by two spaces).
 */
function parseEntries(bodyLines) {
  const groups = []
  let kind = null
  let entry = null
  const push = () => {
    if (entry && kind) groups.push({ kind, text: entry.join('\n').trimEnd() })
    entry = null
  }
  for (const line of bodyLines) {
    const heading = line.match(/^### (.+?)\s*$/)
    if (heading) {
      push()
      // Keep the heading verbatim unless it is one Changesets writes. React's changelogs are
      // entirely Changesets output so only ever carry "<level> Changes", but this repo has a
      // hand-written 0.9.1 using `### Added` and `### Package surface`. Matching only the
      // Changesets form left `kind` unset and silently dropped those entries.
      const level = heading[1].match(/^(Major|Minor|Patch) Changes$/)
      kind = level ? level[1] : heading[1]
      continue
    }
    if (/^- /.test(line)) {
      push()
      entry = [line]
      continue
    }
    if (entry) entry.push(line)
  }
  push()
  return groups
    .map((g) => ({ ...g, text: stripBookkeeping(g.text) }))
    .filter((g) => g.text !== null)
}

const escapeForRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * `  - @youversion/platform-react-native-expo-core@1.6.0`, at any indent. Restricted to the
 * fixed group's own packages: the same shape naming anything else is a real dependency the
 * consumer is being told about, and dropping it loses information.
 */
const DEPENDENCY_BUMP = new RegExp(
  `^\\s*-\\s+(?:${fixedGroups[0].map(escapeForRegExp).join('|')})@\\d[\\w.-]*\\s*$`,
)

/**
 * Changesets' own header for that block, always carrying the originating commit:
 * `- Updated dependencies [80d3718]`. Matching the bare prefix instead would also swallow a
 * hand-written note that happens to open the same way, such as
 * `- Updated dependencies to address CVE-1234.`
 */
const UPDATED_DEPENDENCIES = /^- Updated dependencies \[[0-9a-f]+\]/

/**
 * Remove the fixed group's own version bookkeeping, returning null when an entry is nothing else.
 *
 * Changesets records it two ways and both reach a consumer-facing changelog as noise:
 * an `Updated dependencies` block, and bare `- @pkg@version` lines, either standing alone as
 * their own entry or trailing a real note as continuation lines.
 */
export function stripBookkeeping(text) {
  if (UPDATED_DEPENDENCIES.test(text)) return null
  const kept = text.split('\n').filter((line) => !DEPENDENCY_BUMP.test(line))
  const collapsed = kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
  // Nothing but a bullet marker left, so the entry was only a version bump.
  return /^-\s*$/.test(collapsed) || collapsed === '' ? null : collapsed
}

/**
 * Same note, written slightly differently in two packages' changelogs. Compared on collapsed
 * whitespace so a stray blank line does not split one entry into two.
 */
function dedupeKey(text) {
  return text.replace(/\s+/g, ' ').trim()
}

// Take the package list from the `fixed` group rather than whatever directories happen to
// have a changelog. That group is the reason this merge is valid at all: fixed packages share
// a version, so the same entry appears in each of their changelogs. Reading the filesystem
// instead would silently drop a package whose changelog went missing, and would silently fold
// a future unrelated package into `(all packages)`.
const expected = new Map(
  readdirSync(PACKAGES)
    .filter((d) => existsSync(join(PACKAGES, d, 'package.json')))
    .map((d) => [JSON.parse(readFileSync(join(PACKAGES, d, 'package.json'), 'utf8')).name, d]),
)
const packages = fixedGroups[0].map((name) => {
  const dir = expected.get(name)
  if (!dir || !existsSync(join(PACKAGES, dir, 'CHANGELOG.md'))) {
    throw new Error(
      `Fixed-group package ${name} has no changelog; refusing to write a partial root changelog.`,
    )
  }
  return dir
})

/** Section order in the output. */
const KIND_ORDER = ['Major', 'Minor', 'Patch']

/**
 * Prose written directly under a `## version`, above any `###` heading. Changesets never
 * emits this, but a hand-written release can: both packages summarise 0.9.1 that way.
 */
function preamble(bodyLines) {
  const out = []
  for (const line of bodyLines) {
    if (/^### /.test(line) || /^- /.test(line)) break
    out.push(line)
  }
  return out.join('\n').trim()
}

/** version -> dedupe key -> { kind, packages, text } */
const byVersion = new Map()
/** version -> dedupe key -> { packages, text } for the prose above the first heading */
const byVersionPreamble = new Map()
const order = []

for (const dir of packages) {
  const pkgName = JSON.parse(readFileSync(join(PACKAGES, dir, 'package.json'), 'utf8')).name
  const md = readFileSync(join(PACKAGES, dir, 'CHANGELOG.md'), 'utf8')
  for (const { version, body } of versionSections(md)) {
    if (!byVersion.has(version)) {
      byVersion.set(version, new Map())
      order.push(version)
    }
    if (!byVersionPreamble.has(version)) byVersionPreamble.set(version, new Map())
    const lead = preamble(body)
    if (lead) {
      const leadMap = byVersionPreamble.get(version)
      const leadKey = dedupeKey(lead)
      if (leadMap.has(leadKey)) leadMap.get(leadKey).packages.add(pkgName)
      else leadMap.set(leadKey, { packages: new Set([pkgName]), text: lead })
    }
    const entries = byVersion.get(version)
    for (const { kind, text } of parseEntries(body)) {
      const key = dedupeKey(text)
      const existing = entries.get(key)
      if (!existing) {
        entries.set(key, { kind, packages: new Set([pkgName]), text })
        continue
      }
      existing.packages.add(pkgName)
      // A fixed-group changeset can land under different headings per package: 71e4c1a is
      // Patch for core but Minor for hooks and ui. Keep the most significant kind rather
      // than whichever package readdir happened to return first, so the merged entry is
      // filed where a reader looking for that change would go.
      if (
        KIND_ORDER.includes(kind) &&
        KIND_ORDER.includes(existing.kind) &&
        KIND_ORDER.indexOf(kind) < KIND_ORDER.indexOf(existing.kind)
      ) {
        existing.kind = kind
      }
    }
  }
}

// Newest first. Changesets already writes each file newest-first, and the fixed group means
// every package sees the same versions, so first-seen order is release order.
const out = [
  '# Changelog',
  '',
  'All notable changes to the YouVersion Platform React Native (Expo) SDK.',
  '',
  '`@youversion/platform-react-native-expo-core` and',
  '`@youversion/platform-react-native-expo-ui` are a `fixed` group in `.changeset/config.json`,',
  'so they share a version number and release together. Each entry below notes which packages',
  'it affected.',
  '',
  'Generated from the per-package changelogs by `scripts/build-root-changelog.mjs` — edit those,',
  'or the changeset, rather than this file.',
  '',
]

for (const version of order) {
  out.push(`## ${version}`, '')
  for (const { text, packages: pkgs } of (byVersionPreamble.get(version) ?? new Map()).values()) {
    const scope = pkgs.size === packages.length ? 'all packages' : [...pkgs].sort().join(', ')
    out.push(`_(${scope})_ ${text}`, '')
  }
  const entries = [...byVersion.get(version).values()]
  const extraKinds = [...new Set([...entries.values()].map((e) => e.kind))].filter(
    (k) => !KIND_ORDER.includes(k),
  )
  for (const kind of [...KIND_ORDER, ...extraKinds]) {
    const forKind = entries.filter((e) => e.kind === kind)
    if (forKind.length === 0) continue
    out.push(`### ${KIND_ORDER.includes(kind) ? `${kind} Changes` : kind}`, '')
    for (const { text, packages: pkgs } of forKind) {
      const scope = pkgs.size === packages.length ? 'all packages' : [...pkgs].sort().join(', ')
      out.push(text.replace(/^- /, `- _(${scope})_ `), '')
    }
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(
    join(ROOT, 'CHANGELOG.md'),
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n',
  )
  console.log(`Wrote CHANGELOG.md — ${order.length} versions from ${packages.length} packages.`)
}

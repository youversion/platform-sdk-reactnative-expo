#!/usr/bin/env node
/**
 * Locale JSON checks for packages/ui/src/i18n/locales/.
 *
 * Default mode: parity — every non-en locale JSON must be a subset of en.json
 * (canonical catalog from platform-localization).
 *
 *   - Extra keys (present in a locale, absent from en.json) fail: the catalog
 *     has drifted from the canonical source and i18next would serve a key the
 *     SDK cannot type.
 *   - Missing keys are reported but do not fail. English keys ship as soon as
 *     they are added upstream, while Crowdin translations land later; i18next
 *     falls back to `en` per key, so a lagging catalog is expected, not broken.
 *
 * See docs/contributing/native-i18n.md ("Translation lag").
 *
 * --guard mode (CI pull_request only): fail when locale *.json files changed
 * unless the PR is an automated localization sync. Whitelist (documented here
 * because no sync workflow lives in this repo yet — see native-i18n.md):
 *
 *   1. Actor `platform-localization-pr-bot[bot]` or `github-actions[bot]` — automated
 *      localization sync commits from platform-localization.
 *   2. PR label `localization-sync` — apply to automated distribution PRs.
 *   3. PR title or HEAD commit message containing "sync react native localization" or
 *      "Distribute React Native Localization".
 *
 * index.ts is auto-generated (pnpm generate:locale-index) and checked separately
 * via check:locale-index; it is not guarded by --guard.
 */

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES_DIR = 'packages/ui/src/i18n/locales'
const EN_FILE = 'en.json'
const LOCALE_JSON_PATTERN = /^packages\/ui\/src\/i18n\/locales\/[^/]+\.json$/

/** @param {Record<string, unknown>} obj @param {string} [prefix] */
function collectKeys(obj, prefix = '') {
  /** @type {string[]} */
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(/** @type {Record<string, unknown>} */ (value), fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

/** @param {string} filename */
function loadLocaleKeys(filename) {
  const content = readFileSync(join(LOCALES_DIR, filename), 'utf8')
  return new Set(collectKeys(JSON.parse(content)))
}

function checkParity() {
  const enKeys = loadLocaleKeys(EN_FILE)
  const localeFiles = readdirSync(LOCALES_DIR).filter(
    (file) => file.endsWith('.json') && file !== EN_FILE,
  )

  /** @type {string[]} */
  const errors = []
  /** @type {string[]} */
  const lagging = []
  /** @type {Map<string, number>} */
  const untranslatedKeys = new Map()

  for (const file of localeFiles) {
    const keys = loadLocaleKeys(file)
    const missing = [...enKeys].filter((key) => !keys.has(key)).sort()
    const extra = [...keys].filter((key) => !enKeys.has(key)).sort()

    if (extra.length > 0) {
      errors.push(`${file}:\n  extra keys (${extra.length}): ${extra.join(', ')}`)
    }
    if (missing.length > 0) {
      lagging.push(`${file} (${missing.length})`)
      for (const key of missing) {
        untranslatedKeys.set(key, (untranslatedKeys.get(key) ?? 0) + 1)
      }
    }
  }

  if (errors.length > 0) {
    console.error('Locale parity check failed — locale JSON files must be a subset of en.json:\n')
    console.error(errors.join('\n\n'))
    console.error('\nRemove stale keys in platform-localization, not by hand-editing locale JSON.')
    process.exit(1)
  }

  console.log(
    `Locale parity OK (${localeFiles.length} non-en locale(s) are subsets of ${enKeys.size} en.json key(s)).`,
  )

  if (lagging.length > 0) {
    console.log(
      `\nAwaiting Crowdin translations — these fall back to en at runtime.` +
        `\n  keys (${untranslatedKeys.size}): ${[...untranslatedKeys.keys()].sort().join(', ')}` +
        `\n  locales (${lagging.length}): ${lagging.join(', ')}`,
    )
  }
}

/** @param {string | undefined} json */
function parsePrLabelNames(json) {
  if (!json) {
    return []
  }
  try {
    const labels = JSON.parse(json)
    if (!Array.isArray(labels)) {
      return []
    }
    return labels
      .map((label) => (typeof label === 'string' ? label : label?.name))
      .filter((name) => typeof name === 'string')
  } catch {
    return []
  }
}

/** @param {NodeJS.ProcessEnv} env */
function isSyncPullRequest(env) {
  const allowedActors = ['platform-localization-pr-bot[bot]', 'github-actions[bot]']
  if (allowedActors.includes(env.GITHUB_ACTOR ?? '')) {
    return true
  }

  const allowedLabels = ['localization-sync']
  const prLabels = parsePrLabelNames(env.PR_LABELS_JSON)
  if (prLabels.some((label) => allowedLabels.includes(label))) {
    return true
  }

  const allowedMessagePatterns = [
    'sync react native localization',
    'Distribute React Native Localization',
  ]
  const messages = [env.PR_TITLE, env.HEAD_COMMIT_MESSAGE].filter(Boolean)
  if (
    messages.some((message) => allowedMessagePatterns.some((pattern) => message.includes(pattern)))
  ) {
    return true
  }

  return false
}

/** @param {string} baseRef */
function listChangedLocaleJsonFiles(baseRef) {
  /** @type {string} */
  let diffOutput
  try {
    diffOutput = execSync(`git diff --name-only origin/${baseRef}...HEAD`, {
      encoding: 'utf8',
    })
  } catch {
    diffOutput = execSync('git diff --name-only HEAD~1...HEAD', { encoding: 'utf8' })
  }

  return diffOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((path) => LOCALE_JSON_PATTERN.test(path))
}

function checkGuard() {
  const baseRef = process.env.GITHUB_BASE_REF || 'main'
  const changedLocaleJson = listChangedLocaleJsonFiles(baseRef)

  if (changedLocaleJson.length === 0) {
    console.log('Locale JSON guard OK (no locale *.json changes in diff).')
    return
  }

  if (isSyncPullRequest(process.env)) {
    console.log(
      `Locale JSON guard OK (whitelisted sync PR; ${changedLocaleJson.length} file(s) changed).`,
    )
    return
  }

  console.error('Locale JSON guard failed — locale *.json files must not be hand-edited in PRs.')
  console.error('Changed files:')
  for (const file of changedLocaleJson) {
    console.error(`  - ${file}`)
  }
  console.error(
    '\nAdd keys in platform-localization and let the Distribute React Native Localization workflow sync files.',
  )
  console.error('See docs/contributing/native-i18n.md')
  console.error(
    '\nWhitelisted sync PRs: actor platform-localization-pr-bot[bot] or github-actions[bot], label localization-sync, or title/commit containing "sync react native localization" or "Distribute React Native Localization".',
  )
  process.exit(1)
}

const modeGuard = process.argv.includes('--guard')

if (modeGuard) {
  checkGuard()
} else {
  checkParity()
}

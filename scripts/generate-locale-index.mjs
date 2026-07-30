#!/usr/bin/env node
/**
 * Generates packages/ui/src/i18n/locales/index.ts from on-disk *.json locale files.
 *
 * Sort order: `en` first, then remaining locale codes alphabetically.
 *
 * Usage:
 *   node scripts/generate-locale-index.mjs          — write index.ts
 *   node scripts/generate-locale-index.mjs --check — exit 1 if index.ts is stale
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const LOCALES_DIR = join(REPO_ROOT, 'packages/ui/src/i18n/locales')
const INDEX_FILE = join(LOCALES_DIR, 'index.ts')
const FALLBACK_LNG = 'en'

/** @param {string[]} localeCodes */
function sortLocaleCodes(localeCodes) {
  const others = localeCodes.filter((code) => code !== FALLBACK_LNG).sort()
  return localeCodes.includes(FALLBACK_LNG) ? [FALLBACK_LNG, ...others] : others
}

function listLocaleCodes() {
  return sortLocaleCodes(
    readdirSync(LOCALES_DIR)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, '')),
  )
}

/** @param {string[]} localeCodes */
function generateIndexContent(localeCodes) {
  const importLines = localeCodes.map((code) => `import ${code} from './${code}.json'`).join('\n')

  const resourceEntries = localeCodes
    .map((code) => {
      if (code === FALLBACK_LNG) {
        return `  [SDK_I18N_FALLBACK_LNG]: ${code},`
      }
      return `  ${code}: ${code},`
    })
    .join('\n')

  return `// AUTO-GENERATED — do not edit; run pnpm generate:locale-index
import { SDK_I18N_FALLBACK_LNG, SDK_I18N_NAMESPACE } from '../constants'
import type { SdkTranslationResources } from '../types'
${importLines}

/** Locales with bundled translation resources (synced from platform-localization). */
const localeResources = {
${resourceEntries}
} satisfies Record<string, SdkTranslationResources>

export const supportedSdkLngs = Object.keys(localeResources)

export function buildSdkResources() {
  return Object.fromEntries(
    Object.entries(localeResources).map(([lng, translation]) => [
      lng,
      { [SDK_I18N_NAMESPACE]: translation },
    ]),
  )
}
`
}

function main() {
  const checkMode = process.argv.includes('--check')
  const localeCodes = listLocaleCodes()

  if (localeCodes.length === 0) {
    console.error('No locale JSON files found in', LOCALES_DIR)
    process.exit(1)
  }

  const generated = generateIndexContent(localeCodes)

  if (checkMode) {
    let existing
    try {
      existing = readFileSync(INDEX_FILE, 'utf8')
    } catch {
      console.error(
        'Locale index check failed — index.ts does not exist. Run: pnpm generate:locale-index',
      )
      process.exit(1)
    }

    if (existing !== generated) {
      console.error(
        'Locale index check failed — index.ts is stale. Run: pnpm generate:locale-index',
      )
      process.exit(1)
    }

    console.log(`Locale index OK (${localeCodes.length} locale(s): ${localeCodes.join(', ')}).`)
    return
  }

  writeFileSync(INDEX_FILE, generated, 'utf8')
  console.log(`Generated ${INDEX_FILE} (${localeCodes.length} locale(s): ${localeCodes.join(', ')}).`)
}

main()

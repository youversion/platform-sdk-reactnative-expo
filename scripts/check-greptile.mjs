#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function parseJson(label, text) {
  try {
    return JSON.parse(text)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(`${label} is not valid JSON (${detail})`)
    process.exit(1)
  }
}

const configText = read('.greptile/config.json')
const filesText = read('.greptile/files.json')
const rulesText = read('.greptile/rules.md')
const readmeText = read('README.md')
const tokensAdrText = read('docs/adr/0021-native-design-tokens.md')

const config = parseJson('.greptile/config.json', configText)
const filesDoc = parseJson('.greptile/files.json', filesText)
const rules = config.rules
const contextFiles = filesDoc.files

const failures = []

function check(ok, message) {
  if (!ok) failures.push(message)
}

const ruleIds = ['dom-versus-native', 'nativesheet-test-seam', 'public-api-pin']

check(filesText.includes('0019'), 'files.json text does not contain 0019')
check(filesText.includes('AGENTS.md'), 'files.json text does not contain AGENTS.md')
check(!configText.includes('ADR 0009'), 'config.json raw text contains ADR 0009')
check(!filesText.includes('ADR 0009'), 'files.json raw text contains ADR 0009')

check(
  Array.isArray(contextFiles) &&
    !contextFiles.some(
      (entry) =>
        entry &&
        typeof entry.path === 'string' &&
        entry.path.includes('0009-deferred-dom-localization.md'),
    ),
  'files.json lists 0009-deferred-dom-localization.md',
)

for (const id of ruleIds) {
  check(configText.includes(id), `config.json does not contain ${id}`)
  check(rulesText.includes(id), `rules.md does not contain ${id}`)
}

function ruleById(id) {
  if (!Array.isArray(rules)) return undefined
  return rules.find((rule) => rule && rule.id === id)
}

const domRule = ruleById('dom-versus-native')
check(
  Boolean(domRule && Array.isArray(domRule.scope) && !domRule.scope.includes('packages/ui/src/dom/**')),
  'dom-versus-native scope contains packages/ui/src/dom/**',
)

const seamRule = ruleById('nativesheet-test-seam')
check(
  Boolean(seamRule && typeof seamRule.rule === 'string' && seamRule.rule.includes('install-test-impls.tsx')),
  'nativesheet-test-seam rule text does not contain install-test-impls.tsx',
)

const pinRule = ruleById('public-api-pin')
check(
  Boolean(pinRule && typeof pinRule.rule === 'string' && pinRule.rule.includes('./sdk-version')),
  'public-api-pin rule text does not contain ./sdk-version',
)

const i18nRule = ruleById('native-i18n-no-hardcoded-strings')
check(
  Boolean(i18nRule && typeof i18nRule.rule === 'string' && i18nRule.rule.includes('unprefixed')),
  'native-i18n rule does not say unprefixed shared keys are the default',
)

const fontTokenPath = '0009-bridge-safe-font-tokens.md'
check(readmeText.includes(fontTokenPath), 'README.md does not contain 0009-bridge-safe-font-tokens.md')
check(
  tokensAdrText.includes(fontTokenPath),
  'docs/adr/0021-native-design-tokens.md does not contain 0009-bridge-safe-font-tokens.md',
)

if (failures.length > 0) {
  for (const message of failures) console.error(message)
  process.exit(1)
}

console.log('ok')

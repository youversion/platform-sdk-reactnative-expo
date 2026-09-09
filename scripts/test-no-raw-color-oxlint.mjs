#!/usr/bin/env node
/**
 * Regression tests for design-tokens/no-raw-color oxlint rule.
 *
 * Violation fixtures live under scripts/eslint-fixtures/no-raw-color/.
 * The outside-ui-src-scope fixture lives under packages/ui so product oxlint
 * inspects it. The scripts directory is ignored.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function runOxlint(args) {
  const result = spawnSync('pnpm', ['exec', 'oxlint', '--format', 'json', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const stdout = result.stdout ?? ''
  const start = stdout.indexOf('{')
  if (start === -1) {
    throw new Error(`oxlint produced no JSON:\n${stdout}\n${result.stderr}`)
  }
  return JSON.parse(stdout.slice(start))
}

function rawColorDiagnostics(report, fileSuffix) {
  const diagnostics = report.diagnostics ?? []
  return diagnostics.filter((diagnostic) => {
    const code = diagnostic.code ?? ''
    const isRawColor =
      code === 'design-tokens(no-raw-color)' ||
      code === 'eslint(design-tokens/no-raw-color)'
    return isRawColor && diagnostic.filename?.endsWith(fileSuffix)
  })
}

test('no-raw-color oxlint flags hex, rgb(), and oklch() literals', () => {
  const report = runOxlint([
    '--config',
    'scripts/oxlint-no-raw-color-test.config.ts',
    'scripts/eslint-fixtures/no-raw-color/violations.tsx',
  ])
  const messages = rawColorDiagnostics(report, 'violations.tsx')
  assert.ok(messages.length >= 3, 'expected violations.tsx to report design-tokens/no-raw-color')

  const reportedValues = messages.map((message) => message.message)
  assert.ok(
    reportedValues.some((message) => message.includes('#ff0000')),
    'expected a violation for hex #ff0000',
  )
  assert.ok(
    reportedValues.some((message) => message.includes('rgb(')),
    'expected a violation for rgb()',
  )
  assert.ok(
    reportedValues.some((message) => message.includes('oklch(')),
    'expected a violation for oklch()',
  )
})

test('no-raw-color oxlint allows rgba(), interpolated hex, and rgb/oklch in prose', () => {
  const report = runOxlint([
    '--config',
    'scripts/oxlint-no-raw-color-test.config.ts',
    'scripts/eslint-fixtures/no-raw-color/allowed.tsx',
  ])

  assert.equal(
    rawColorDiagnostics(report, 'allowed.tsx').length,
    0,
    'rgba(), template-interpolated hex, and rgb/oklch mentioned in prose must not be flagged',
  )
})

test('no-raw-color oxlint ignores __tests__ and *.test.tsx under ui scope', () => {
  const report = runOxlint([
    '--config',
    'scripts/oxlint-no-raw-color-test.config.ts',
    'scripts/eslint-fixtures/no-raw-color/simulated-ui',
  ])

  assert.ok(
    report.number_of_files > 0,
    'oxlint must inspect the simulated-ui fixtures; an ignored directory hides an exclusion regression',
  )
  assert.ok(
    rawColorDiagnostics(report, 'in-scope.tsx').length > 0,
    'in-scope fixture must be flagged so exclusion assertions exercise the same run',
  )
  assert.equal(
    rawColorDiagnostics(report, 'excluded.tsx').length,
    0,
    '__tests__ fixture should not be flagged by no-raw-color oxlint',
  )
  assert.equal(
    rawColorDiagnostics(report, 'excluded.test.tsx').length,
    0,
    '*.test.tsx fixture should not be flagged by no-raw-color oxlint',
  )
})

test('no-raw-color oxlint does not apply outside packages/ui/src', () => {
  const report = runOxlint([
    '--config',
    'oxlint.config.ts',
    'packages/ui/outside-ui-src-scope.fixture.tsx',
  ])
  assert.ok(
    report.number_of_files > 0,
    'oxlint must inspect the outside-ui-src-scope fixture; an ignored file hides a scope regression',
  )
  assert.equal(
    rawColorDiagnostics(report, 'outside-ui-src-scope.fixture.tsx').length,
    0,
    'files outside packages/ui/src must not be flagged by no-raw-color oxlint',
  )
})

const PRODUCTION_EXCLUDED_HEX_FILES = [
  'packages/ui/src/theme/palette.ts',
  'packages/ui/src/native/bible-app-logo.tsx',
  'packages/ui/src/native/youversion-platform-logo.tsx',
  'packages/ui/src/lib/__tests__/color.test.ts',
  'packages/ui/src/native/__tests__/bible-verse-action-swatch-fill.test.tsx',
]

test('no-raw-color oxlint production excludeFiles suppress theme, logos, and tests', () => {
  for (const relativePath of PRODUCTION_EXCLUDED_HEX_FILES) {
    const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
    assert.match(
      source,
      /#[0-9a-fA-F]{3,8}/,
      `${relativePath} must still contain a hex literal so a broken excludeFiles would be visible`,
    )
  }

  const report = runOxlint(['--config', 'oxlint.config.ts', ...PRODUCTION_EXCLUDED_HEX_FILES])
  assert.ok(
    report.number_of_files >= PRODUCTION_EXCLUDED_HEX_FILES.length,
    'oxlint must inspect the production allow-listed files; an ignored path hides an excludeFiles regression',
  )
  assert.equal(
    rawColorDiagnostics(report, 'theme/palette.ts').length,
    0,
    'theme/ must stay excluded by production excludeFiles',
  )
  assert.equal(
    rawColorDiagnostics(report, 'native/bible-app-logo.tsx').length,
    0,
    'bible-app-logo.tsx must stay excluded by production excludeFiles',
  )
  assert.equal(
    rawColorDiagnostics(report, 'native/youversion-platform-logo.tsx').length,
    0,
    'youversion-platform-logo.tsx must stay excluded by production excludeFiles',
  )
  assert.equal(
    rawColorDiagnostics(report, 'lib/__tests__/color.test.ts').length,
    0,
    '*.test.ts under ui src must stay excluded by production excludeFiles',
  )
  assert.equal(
    rawColorDiagnostics(report, 'native/__tests__/bible-verse-action-swatch-fill.test.tsx').length,
    0,
    '*.test.tsx under ui src must stay excluded by production excludeFiles',
  )
})

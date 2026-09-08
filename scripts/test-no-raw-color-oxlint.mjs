#!/usr/bin/env node
/**
 * Regression tests for design-tokens/no-raw-color oxlint rule.
 *
 * Violation fixtures live under scripts/eslint-fixtures/no-raw-color/.
 * The scripts directory is ignored by product oxlint.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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

test('no-raw-color oxlint allows rgba() and template-interpolated hex', () => {
  const report = runOxlint([
    '--config',
    'scripts/oxlint-no-raw-color-test.config.ts',
    'scripts/eslint-fixtures/no-raw-color/allowed.tsx',
  ])

  assert.equal(
    rawColorDiagnostics(report, 'allowed.tsx').length,
    0,
    'rgba() and template-interpolated hex must not be flagged',
  )
})

test('no-raw-color oxlint ignores __tests__ and *.test.tsx under ui scope', () => {
  const report = runOxlint([
    '--config',
    'scripts/oxlint-no-raw-color-test.config.ts',
    'scripts/eslint-fixtures/no-raw-color/simulated-ui',
  ])

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
    'scripts/eslint-fixtures/no-raw-color/violations.tsx',
  ])
  assert.equal(
    rawColorDiagnostics(report, 'violations.tsx').length,
    0,
    'files outside packages/ui/src must not be flagged by no-raw-color oxlint',
  )
})

#!/usr/bin/env node
/**
 * Regression tests for native i18n oxlint (i18next/no-literal-string jsx-attributes).
 *
 * Fixtures live under scripts/eslint-fixtures/native-i18n/.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { NATIVE_I18N_JSX_ATTRIBUTES } from './native-i18n-attributes.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const REQUIRED_VIOLATION_ATTRIBUTES = [
  'accessibilityLabel',
  'accessibilityHint',
  'placeholder',
  'headerTitle',
  'title',
  'label',
]

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

function i18nDiagnostics(report, fileSuffix) {
  const diagnostics = report.diagnostics ?? []
  return diagnostics.filter((diagnostic) => {
    const code = diagnostic.code ?? ''
    const isI18n = code === 'i18next(no-literal-string)' || code === 'eslint(i18next/no-literal-string)'
    return isI18n && diagnostic.filename?.endsWith(fileSuffix)
  })
}

test('native i18n oxlint uses jsx-only mode so included JSX attributes are checked', () => {
  const report = runOxlint([
    '--config',
    'scripts/oxlint-native-i18n-test.config.ts',
    'scripts/eslint-fixtures/native-i18n/violations.tsx',
  ])
  const messages = i18nDiagnostics(report, 'violations.tsx')
  assert.ok(messages.length > 0, 'expected violations.tsx to report i18next/no-literal-string')

  const reportedAttributes = new Set(
    messages
      .map((message) => message.message.match(/:\s*(\w+)=/)?.[1])
      .filter((name) => typeof name === 'string'),
  )

  for (const attribute of REQUIRED_VIOLATION_ATTRIBUTES) {
    assert.ok(
      reportedAttributes.has(attribute),
      `expected a violation for JSX attribute ${attribute}`,
    )
  }
})

test('native i18n oxlint ignores __tests__ and *.test.tsx under native scope', () => {
  const report = runOxlint([
    '--config',
    'scripts/oxlint-native-i18n-test.config.ts',
    'scripts/eslint-fixtures/native-i18n/simulated-native',
  ])

  assert.equal(
    i18nDiagnostics(report, 'excluded.tsx').length,
    0,
    '__tests__ fixture should not be flagged by native i18n oxlint',
  )
  assert.equal(
    i18nDiagnostics(report, 'excluded.test.tsx').length,
    0,
    '*.test.tsx fixture should not be flagged by native i18n oxlint',
  )
})

test('native i18n oxlint does not apply outside packages/ui/src/native', () => {
  const report = runOxlint([
    '--config',
    'oxlint.config.ts',
    'scripts/eslint-fixtures/native-i18n/outside-native-scope.tsx',
  ])
  assert.equal(
    i18nDiagnostics(report, 'outside-native-scope.tsx').length,
    0,
    'files outside packages/ui/src/native must not be flagged by native i18n oxlint',
  )
})

test('native i18n JSX attribute include list is shared with oxlint.config.ts', () => {
  const configSource = readFileSync(new URL('../oxlint.config.ts', import.meta.url), 'utf8')
  assert.match(
    configSource,
    /NATIVE_I18N_JSX_ATTRIBUTES/,
    'oxlint.config.ts must import NATIVE_I18N_JSX_ATTRIBUTES',
  )
  assert.ok(NATIVE_I18N_JSX_ATTRIBUTES.includes('accessibilityLabel'))
})

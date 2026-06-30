#!/usr/bin/env node
/**
 * Regression tests for native i18n ESLint (i18next/no-literal-string jsx-attributes).
 *
 * Fixtures live under scripts/eslint-fixtures/native-i18n/ and are NOT linted by `eslint .`.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import tsParser from '@typescript-eslint/parser'
import { ESLint } from 'eslint'

import eslintConfig from '../eslint.config.mjs'
import {
  NATIVE_I18N_JSX_ATTRIBUTES,
  createNativeI18nFlatBlock,
} from './eslint-native-i18n-config.mjs'

const FIXTURES_GLOB = 'scripts/eslint-fixtures/native-i18n/**/*.{ts,tsx}'
const SIMULATED_NATIVE_GLOB = 'scripts/eslint-fixtures/native-i18n/simulated-native/**/*.{ts,tsx}'

const REQUIRED_VIOLATION_ATTRIBUTES = [
  'accessibilityLabel',
  'accessibilityHint',
  'placeholder',
  'headerTitle',
  'title',
  'label',
]

/** @param {string} filePath @param {import('eslint').Linter.Config[]} config */
async function lintWithConfig(filePath, config) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parser: tsParser,
          parserOptions: {
            ecmaFeatures: { jsx: true },
          },
        },
      },
      ...config,
    ],
  })

  const results = await eslint.lintFiles([filePath])
  return results.flatMap((result) => result.messages)
}

/** @param {import('eslint').Linter.LintMessage[]} messages */
function i18nLiteralMessages(messages) {
  return messages.filter((message) => message.ruleId === 'i18next/no-literal-string')
}

test('native i18n ESLint uses jsx-only mode so included JSX attributes are checked', async () => {
  const violationsFile = 'scripts/eslint-fixtures/native-i18n/violations.tsx'
  const messages = await lintWithConfig(violationsFile, [
    createNativeI18nFlatBlock({
      files: [FIXTURES_GLOB],
    }),
  ])

  const i18nMessages = i18nLiteralMessages(messages)
  assert.ok(i18nMessages.length > 0, 'expected violations.tsx to report i18next/no-literal-string errors')

  const reportedAttributes = new Set(
    i18nMessages
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

test('native i18n ESLint ignores __tests__ and *.test.tsx under native scope', async () => {
  const config = createNativeI18nFlatBlock({
    files: [SIMULATED_NATIVE_GLOB],
    ignores: [
      'scripts/eslint-fixtures/native-i18n/simulated-native/**/__tests__/**',
      'scripts/eslint-fixtures/native-i18n/simulated-native/**/*.test.{ts,tsx}',
    ],
  })

  const testsDirFile =
    'scripts/eslint-fixtures/native-i18n/simulated-native/__tests__/excluded.tsx'
  const testFile = 'scripts/eslint-fixtures/native-i18n/simulated-native/excluded.test.tsx'

  const testsDirMessages = i18nLiteralMessages(await lintWithConfig(testsDirFile, [config]))
  const testFileMessages = i18nLiteralMessages(await lintWithConfig(testFile, [config]))

  assert.equal(
    testsDirMessages.length,
    0,
    '__tests__ fixture should not be flagged by native i18n ESLint',
  )
  assert.equal(
    testFileMessages.length,
    0,
    '*.test.tsx fixture should not be flagged by native i18n ESLint',
  )
})

test('native i18n ESLint does not apply outside packages/ui/src/native', async () => {
  const outsideFile = 'scripts/eslint-fixtures/native-i18n/outside-native-scope.tsx'
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: eslintConfig,
  })

  const results = await eslint.lintFiles([outsideFile])
  const i18nMessages = i18nLiteralMessages(results.flatMap((result) => result.messages))

  assert.equal(
    i18nMessages.length,
    0,
    'files outside packages/ui/src/native must not be flagged by native i18n ESLint',
  )
})

test('native i18n JSX attribute include list matches eslint.config.mjs', () => {
  const productionBlock = eslintConfig.find(
    (block) => block.rules?.['i18next/no-literal-string'],
  )
  const ruleOptions = productionBlock?.rules?.['i18next/no-literal-string']?.[1]

  assert.equal(ruleOptions?.mode, 'jsx-only', 'production config must use jsx-only mode')
  assert.deepEqual(
    ruleOptions?.['jsx-attributes']?.include,
    NATIVE_I18N_JSX_ATTRIBUTES,
    'jsx-attributes.include must stay in sync with scripts/eslint-native-i18n-config.mjs',
  )
})

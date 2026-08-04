import assert from 'node:assert/strict'
import { test } from 'node:test'

import { generateIndexContent, toImportIdentifier } from './generate-locale-index.mjs'

test('toImportIdentifier converts hyphenated locale codes to valid bindings', () => {
  assert.equal(toImportIdentifier('en'), 'en')
  assert.equal(toImportIdentifier('pt-BR'), 'pt_BR')
  assert.equal(toImportIdentifier('zh-Hans'), 'zh_Hans')
})

test('generateIndexContent emits valid TypeScript for hyphenated locale codes', () => {
  const output = generateIndexContent(['en', 'pt-BR'])

  assert.match(output, /import en from '\.\/en\.json'/)
  assert.match(output, /import pt_BR from '\.\/pt-BR\.json'/)
  assert.match(output, /\[SDK_I18N_FALLBACK_LNG\]: en,/)
  assert.match(output, /'pt-BR': pt_BR,/)
  assert.doesNotMatch(output, /import pt-BR/)
})

test('generateIndexContent types catalogs as Partial so untranslated keys can lag en.json', () => {
  const output = generateIndexContent(['en', 'fr'])

  assert.match(output, /satisfies Record<string, Partial<SdkTranslationResources>>/)
})

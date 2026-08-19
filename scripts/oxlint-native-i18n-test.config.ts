import { defineConfig } from 'oxlint'
import { NATIVE_I18N_JSX_ATTRIBUTES } from './native-i18n-attributes.ts'

const i18nRule = [
  'error',
  {
    framework: 'react',
    mode: 'jsx-only',
    'jsx-attributes': {
      include: [...NATIVE_I18N_JSX_ATTRIBUTES],
    },
  },
] as const

export default defineConfig({
  jsPlugins: [{ name: 'i18next', specifier: 'eslint-plugin-i18next' }],
  overrides: [
    {
      files: ['scripts/eslint-fixtures/native-i18n/**/*.{ts,tsx}'],
      excludeFiles: [
        'scripts/eslint-fixtures/native-i18n/simulated-native/**/__tests__/**',
        'scripts/eslint-fixtures/native-i18n/simulated-native/**/*.test.{ts,tsx}',
        'scripts/eslint-fixtures/native-i18n/outside-native-scope.tsx',
      ],
      rules: {
        'i18next/no-literal-string': i18nRule,
      },
    },
  ],
})

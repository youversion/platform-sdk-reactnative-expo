import { defineConfig } from 'oxlint'
import { NATIVE_I18N_JSX_ATTRIBUTES } from './native-i18n-attributes.ts'

export default defineConfig({
  ignorePatterns: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
  jsPlugins: [{ name: 'i18next', specifier: 'eslint-plugin-i18next' }],
  rules: {
    'i18next/no-literal-string': [
      'error',
      {
        framework: 'react',
        mode: 'jsx-only',
        'jsx-attributes': {
          include: [...NATIVE_I18N_JSX_ATTRIBUTES],
        },
      },
    ],
  },
})

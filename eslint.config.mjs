import expoConfig from 'eslint-config-expo/flat.js'
import prettierConfig from 'eslint-config-prettier/flat'
import { createNativeI18nFlatBlock } from './scripts/eslint-native-i18n-config.mjs'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.config.js',
    ],
  },
  ...expoConfig,
  prettierConfig,
  {
    // Non-null assertions (`x!`) silently defeat noUncheckedIndexedAccess and
    // strict null checks the same way `as` does. Narrow with a guard instead.
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // Tests own their fixtures, so a non-null assertion on known-good data is
    // an acceptable shortcut here.
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  createNativeI18nFlatBlock({
    ignores: [
      'packages/ui/src/native/**/__tests__/**',
      'packages/ui/src/native/**/*.test.{ts,tsx}',
    ],
  }),
]

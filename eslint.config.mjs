import expoConfig from 'eslint-config-expo/flat.js'
import prettierConfig from 'eslint-config-prettier/flat'
import { createNativeI18nFlatBlock } from './scripts/eslint-native-i18n-config.mjs'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/build/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/.claude/**',
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
  {
    // Publish/tooling scripts run in Node as CommonJS. Declare the module
    // globals so `no-undef` does not flag `__dirname`/`require`/`module`.
    files: ['**/scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  createNativeI18nFlatBlock({
    ignores: [
      'packages/ui/src/native/**/__tests__/**',
      'packages/ui/src/native/**/*.test.{ts,tsx}',
    ],
  }),
]

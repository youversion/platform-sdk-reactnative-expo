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
  createNativeI18nFlatBlock({
    ignores: [
      'packages/ui/src/native/**/__tests__/**',
      'packages/ui/src/native/**/*.test.{ts,tsx}',
    ],
  }),
]

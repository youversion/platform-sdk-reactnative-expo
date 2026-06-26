import expoConfig from 'eslint-config-expo/flat.js'
import prettierConfig from 'eslint-config-prettier/flat'
import i18next from 'eslint-plugin-i18next'

/** User-visible JSX attributes that must use useSdkTranslation() / t() / Trans. */
const NATIVE_I18N_JSX_ATTRIBUTES = [
  'accessibilityLabel',
  'accessibilityHint',
  'headerTitle',
  'placeholder',
  'title',
  'label',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
]

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
    files: ['packages/ui/src/native/**/*.{ts,tsx}'],
    ignores: [
      'packages/ui/src/native/**/__tests__/**',
      'packages/ui/src/native/**/*.test.{ts,tsx}',
    ],
    plugins: {
      i18next,
    },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          framework: 'react',
          mode: 'jsx-text-only',
          'jsx-attributes': {
            include: NATIVE_I18N_JSX_ATTRIBUTES,
          },
          message:
            'Use useSdkTranslation() with t() or <Trans i18nKey> for user-visible native strings. See docs/contributing/native-i18n.md.',
        },
      ],
    },
  },
]

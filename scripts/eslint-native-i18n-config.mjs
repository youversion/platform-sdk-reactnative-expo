import i18next from 'eslint-plugin-i18next'

/** User-visible JSX attributes that must use useSdkTranslation() / t() / Trans. */
export const NATIVE_I18N_JSX_ATTRIBUTES = [
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

export const NATIVE_I18N_LITERAL_STRING_RULE = [
  'error',
  {
    framework: 'react',
    mode: 'jsx-only',
    'jsx-attributes': {
      include: NATIVE_I18N_JSX_ATTRIBUTES,
    },
    message:
      'Use useSdkTranslation() with t() or <Trans i18nKey> for user-visible native strings. See docs/contributing/native-i18n.md.',
  },
]

/** @param {{ files?: string[], ignores?: string[] }} [options] */
export function createNativeI18nFlatBlock({ files, ignores = [] } = {}) {
  return {
    files: files ?? ['packages/ui/src/native/**/*.{ts,tsx}'],
    ignores,
    plugins: {
      i18next,
    },
    rules: {
      'i18next/no-literal-string': NATIVE_I18N_LITERAL_STRING_RULE,
    },
  }
}

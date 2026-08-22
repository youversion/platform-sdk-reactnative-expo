import { defineConfig } from 'oxlint'
import { NATIVE_I18N_JSX_ATTRIBUTES } from './scripts/native-i18n-attributes.ts'

const antiSlopRules = {
  'anti-slop/no-chained-type-assertions': 'error',
  'anti-slop/no-conditional-empty-object-spread': 'error',
  'anti-slop/no-known-value-widening': 'error',
  'anti-slop/no-module-mocking': 'error',
  'anti-slop/no-object-parameters': 'error',
  'anti-slop/no-reflect-apply': 'error',
  'anti-slop/no-reflect-get': 'error',
  'anti-slop/no-runtime-typeof': 'error',
  'anti-slop/no-shape-in-symbol-names': 'error',
  'anti-slop/no-unknown-parameters': 'error',
  'anti-slop/no-unknown-returns': 'error',
  'anti-slop/no-unknown-type-aliases': 'error',
  'anti-slop/no-unsafe-dictionary-type': 'error',
  'anti-slop/no-widen-then-assert': 'error',
  'anti-slop/require-safety-comment-for-type-assertion': 'error',
} as const

export default defineConfig({
  options: {
    typeAware: true,
  },
  ignorePatterns: [
    '.agent/**',
    '.agents/**',
    '.claude/**',
    '.codegraph/**',
    '.codex/**',
    '.continue/**',
    '.cursor/**',
    '.firecrawl/**',
    '.gemini/**',
    '.humanlayer/**',
    '.omc/**',
    '.opencode/**',
    '.pi/**',
    '.roo/**',
    '.scratch/**',
    '.windsurf/**',
    '**/.expo/**',
    '**/.turbo/**',
    '**/android/**',
    '**/build/**',
    '**/coverage/**',
    '**/ios/**',
    '**/jest.setup.js',
    '**/*.d.ts',
    '**/scripts/**',
    'tools/oxlint/anti-slop/**',
    '**/*.config.js',
    '**/*.config.cjs',
    '**/*.config.mjs',
    '**/*.config.ts',
  ],
  jsPlugins: [
    { name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' },
    { name: 'i18next', specifier: 'eslint-plugin-i18next' },
    { name: 'expo', specifier: 'eslint-plugin-expo' },
  ],
  categories: {
    correctness: 'error',
  },
  rules: {
    ...antiSlopRules,
    'typescript/no-non-null-assertion': 'error',
    'typescript/no-explicit-any': 'off',
    'typescript/restrict-template-expressions': ['error', { allowNumber: true }],
    'typescript/prefer-nullish-coalescing': 'off',
    'typescript/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    'typescript/explicit-module-boundary-types': 'error',
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/await-thenable': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'expo/use-dom-exports': 'error',
    'expo/no-env-var-destructuring': 'error',
    'expo/no-dynamic-env-var': 'error',
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', '**/test-utils/**'],
      rules: {
        'typescript/no-non-null-assertion': 'off',
        'typescript/explicit-module-boundary-types': 'off',
        // spyOn(obj, 'method') and RTL onPress handlers are test noise.
        'typescript/unbound-method': 'off',
        'typescript/no-misused-promises': 'off',
        'typescript/no-floating-promises': 'off',
        'typescript/no-redundant-type-constituents': 'off',
      },
    },
    {
      files: ['apps/example/**'],
      rules: {
        'typescript/explicit-module-boundary-types': 'off',
      },
    },
    {
      files: ['packages/ui/src/native/**/*.{ts,tsx}'],
      excludeFiles: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'i18next/no-literal-string': [
          'error',
          {
            framework: 'react',
            mode: 'jsx-only',
            'jsx-attributes': {
              include: [...NATIVE_I18N_JSX_ATTRIBUTES],
            },
            message:
              'Use useSdkTranslation() with t() or <Trans i18nKey> for user-visible native strings. See docs/contributing/native-i18n.md.',
          },
        ],
      },
    },
  ],
})

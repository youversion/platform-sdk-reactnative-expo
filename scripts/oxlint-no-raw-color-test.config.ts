import { defineConfig } from 'oxlint'

export default defineConfig({
  ignorePatterns: [
    '**/__tests__/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/theme/**',
    '**/bible-app-logo.tsx',
    '**/youversion-platform-logo.tsx',
  ],
  jsPlugins: [{ name: 'design-tokens', specifier: '../tools/oxlint/design-tokens/index.ts' }],
  rules: {
    'design-tokens/no-raw-color': 'error',
  },
})

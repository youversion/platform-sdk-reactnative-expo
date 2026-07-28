// Jest config lives here rather than in package.json so the `.mjs` transform
// below can reuse the preset's own babel-jest entry instead of duplicating its
// (absolute-path) options.
const preset = require('jest-expo/jest-preset')

module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react$': '<rootDir>/../../node_modules/react',
    '^react/(.*)$': '<rootDir>/../../node_modules/react/$1',
    '^react-dom$': '<rootDir>/../../node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/../../node_modules/react-dom/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|expo-.*|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|jest-expo|@rn-primitives|better-result))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  // `@youversion/platform-react-ui` requires `better-result`, which ships ESM
  // only (`.mjs`, no CJS build). jest-expo's transform key matches `.[jt]sx?`
  // alone, so without this the file reaches the CJS runtime untransformed and
  // dies on its `export {}` — taking down any suite that imports a value from
  // the Web SDK barrel.
  transform: {
    ...preset.transform,
    '\\.mjs$': preset.transform['\\.[jt]sx?$'],
  },
}

// Build a jest config that:
//  1. extends `jest-expo/web` (jsdom + babel-preset-expo via Metro caller)
//  2. swaps the test environment for `jest-fixed-jsdom` so MSW + undici get
//     real Node fetch/Request/Response/TextEncoder/ReadableStream
//  3. forces jsdom to use the default export condition so `msw/node` resolves
//  4. extends `transformIgnorePatterns` so MSW's ESM-only deps (rettime,
//     until-async, etc.) get transpiled by babel before they're loaded
//  5. extends the JS transform regex to include `.mjs` files (rettime ships
//     only `.mjs`)
const webPreset = require('jest-expo/web/jest-preset')

const upstreamJsTransformKey = Object.keys(webPreset.transform).find((k) =>
  Array.isArray(webPreset.transform[k])
    ? webPreset.transform[k][0] === 'babel-jest'
    : webPreset.transform[k] === 'babel-jest',
)
const upstreamJsTransformValue = webPreset.transform[upstreamJsTransformKey]
const transform = { ...webPreset.transform }
delete transform[upstreamJsTransformKey]
transform['\\.m?[jt]sx?$'] = upstreamJsTransformValue

module.exports = {
  ...webPreset,
  testEnvironment: 'jest-fixed-jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    ...(webPreset.moduleNameMapper || {}),
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform,
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|msw|@mswjs|@bundled-es-modules|@open-draft|rettime|until-async|strict-event-emitter|headers-polyfill|outvariant))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
}

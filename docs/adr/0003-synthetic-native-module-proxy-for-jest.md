# Synthetic nativeModuleProxy for jest-expo

React Native 0.83's `NativeModules.js` checks `global.nativeModuleProxy` then `global.__fbBatchedBridgeConfig`. The RN jest setup mocks `NativeModules` via `jest.mock`, but `StyleSheet` (and other modules that call `TurboModuleRegistry` at module scope) loads before the mock takes effect, hitting the `__fbBatchedBridgeConfig` invariant. jest-expo's setup also mocks `NativeModules` via `jest.doMock`, but the same race applies.

We set `global.nativeModuleProxy` in `jest.setup.js` with minimal `DeviceInfo` and `PlatformConstants` constants so that `StyleSheet.create()` at module scope in source files resolves without the native bridge. This accepts that we own a small surface of native module constants instead of relying on jest-expo to provide them. If jest-expo or RN fixes the initialization order, this proxy can be removed.

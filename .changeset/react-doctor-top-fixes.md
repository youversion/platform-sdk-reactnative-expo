---
'@youversion/platform-react-native-expo-core': patch
'@youversion/platform-react-native-expo-ui': patch
---

Fix the top issues flagged by React Doctor. Replace relative barrel imports (`../storage`, `../lib`, `../hooks`, `../i18n`) with direct module paths to trim the app bundle and speed startup. Fix a stale-closure risk in the auth bootstrap effect by holding the latest `setAuthState`/`refreshToken`/`clearAuthState` in a ref instead of silencing the exhaustive-deps warning, preserving mount-only behavior. Reset version-picker state during render (previous-prop comparison) instead of in an effect, removing a brief stale-UI frame on sheet reopen in both the DOM picker and the native picker sheet. Drop a dead duplicate `READER_SETTINGS_PERSIST_KEY` export from core storage.

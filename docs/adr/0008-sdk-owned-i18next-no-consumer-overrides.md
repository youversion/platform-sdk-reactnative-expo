# SDK-owned i18next without consumer overrides

Native UI strings use a **private** i18next instance created with `createInstance()` inside `@youversion/platform-react-native-expo-ui`. The instance is not exported; consumers cannot merge resource bundles or pass an `i18n` prop on `YouVersionProvider`.

**Consumer surface:** optional `locale?: string` on `YouVersionProvider`. When omitted, the SDK reads the device locale via bundled `expo-localization` and updates when OS locale changes. Pass `locale` explicitly when the app owns language selection (in-app picker, persisted preference).

**Scope:** `locale` drives native UI (auth button, sheet chrome, loader accessibility) and is forwarded as resolved `lng` into each Expo DOM web `YouVersionProvider` so in-WebView copy follows the same language — see [ADR 0019](./0019-provider-locale-crosses-dom-bridge.md). It is not Bible `languageId`.

**Not supported:** `texts` allowlists, per-component string overrides, or exporting `createSdkI18n` / resource builders for host-app bundle merging.

Runtime dependencies: `i18next`, `react-i18next`, and `expo-localization` are bundled with `@youversion/platform-react-native-expo-ui`. Consumers are not required to install them for SDK localization.

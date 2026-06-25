# Deferred DOM localization

Expo DOM components in this SDK wrap `@youversion/platform-react-ui` inside WebViews. The team is moving away from WebViews as the long-term presentation layer for Bible UI.

**Decision:** Do **not** bridge `YouVersionProvider locale` as `lng` into DOM WebViews. DOM copy stays in the Web SDK default language (English). The published Web SDK v2 does not consume `lng` on its provider anyway.

**Native i18n remains:** `locale` on `YouVersionProvider` continues to drive the SDK-owned native i18next instance (`useSdkTranslation`, auth button labels, sheet loader accessibility, native sheet headers). See [ADR 0007](./0007-app-locale-vs-bible-language-id.md) and [ADR 0008](./0008-sdk-owned-i18next-no-consumer-overrides.md).

**Revisit when:** WebView-based DOM components are still in production and product requires localized in-WebView strings (reader chrome, picker labels, footnotes). If WebViews are replaced by fully native presentation, DOM localization becomes moot.

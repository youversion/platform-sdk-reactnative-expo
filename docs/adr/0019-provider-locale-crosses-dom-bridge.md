---
Status: accepted — supersedes ADR 0009
---

# Resolved provider locale crosses the DOM bridge

Expo DOM components wrap `@youversion/platform-react-ui` inside WebViews. Native `YouVersionProvider locale` already resolved to a supported SDK code (`lng`, e.g. `es-MX` → `es`). The web SDK now accepts `locale` on its `YouVersionProvider` (YPE-5119).

**Decision:** Forward that resolved `lng` across the DOM bridge as `locale` into each web `YouVersionProvider`. Native wrappers read `useLocale().lng` and pass `locale={lng}`. DOM entries accept `locale` and set it on the inner web provider. Hosts still set `locale` only on Expo `YouVersionProvider`; the public consumer API is unchanged.

This supersedes [ADR 0009](0009-deferred-dom-localization.md), which deferred bridging because the published web SDK did not consume a language prop.

**Still distinct from Bible language:** `locale` is app UI language (native chrome and in-WebView copy). It is not Bible `languageId` / `versionId`. See [ADR 0007](0007-app-locale-vs-bible-language-id.md).

**DOM files still do not own i18n keys.** In-WebView strings come from the web SDK. Native keys stay in platform-localization. See [native-i18n](../contributing/native-i18n.md).

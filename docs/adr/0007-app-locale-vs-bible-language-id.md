# App locale vs Bible languageId

The React Native Expo SDK distinguishes **app locale** (native UI strings) from **Bible translation language** (API `languageId` / version picker filter).

- **`YouVersionProvider locale`** — BCP-47-ish tag for SDK-owned **native** strings (`YouVersionAuthButton`, sheet loader accessibility, native sheet headers). Defaults to the device locale when omitted; pass explicitly when the app manages language. See [ADR 0008](./0008-sdk-owned-i18next-no-consumer-overrides.md).
- **`versionId` / language picker** — Selects which Bible translation to render. Owned by reader/card props and in-sheet DOM state; never derived from `locale`.

Do not map device locale to a default Bible version or conflate picker `languageId` with provider `locale`.

**DOM / WebView copy:** Expo DOM components (Bible reader, pickers, footnotes) render Web SDK UI inside WebViews. That layer is **not** localized by `locale` — strings stay in the Web SDK default language (English). See [ADR 0009](./0009-deferred-dom-localization.md).

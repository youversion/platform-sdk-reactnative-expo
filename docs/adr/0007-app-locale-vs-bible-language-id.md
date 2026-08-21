# App locale vs Bible languageId

The React Native Expo SDK distinguishes **app locale** (native UI strings) from **Bible translation language** (API `languageId` / version picker filter).

- **`YouVersionProvider locale`** — BCP-47-ish tag for SDK-owned UI strings. Native chrome (`YouVersionAuthButton`, sheet loader accessibility, native sheet headers) and in-WebView copy both follow the resolved `lng`. Defaults to the device locale when omitted; pass explicitly when the app manages language. See [ADR 0008](./0008-sdk-owned-i18next-no-consumer-overrides.md) and [ADR 0019](./0019-provider-locale-crosses-dom-bridge.md).
- **`versionId` / language picker** — Selects which Bible translation to render. Owned by reader/card props and in-sheet DOM state; never derived from `locale`.

Do not map device locale to a default Bible version or conflate picker `languageId` with provider `locale`.

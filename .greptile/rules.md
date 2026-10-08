# Native UI localization (P0)

Applies to `packages/ui/src/native/**`. Full guide: [docs/contributing/native-i18n.md](../docs/contributing/native-i18n.md).

## Required pattern

- Call `useSdkTranslation()` and render copy with `t('key')` or `<Trans i18nKey="key">`.
- Prefer an unprefixed shared key in [platform-localization](https://github.com/youversion/platform-localization) (`sources/common/en.json`). Use `reactnative.*` only when the string belongs to this SDK alone, and say why in `_comment`. Keys are typed via `SdkTranslationKey` after sync.

## Flag as high severity

Any newly added or changed user-visible English literal in native source — not only known examples. Flag hardcoded English in:

- `<Text>` children owned by the SDK
- `accessibilityLabel` and `accessibilityHint` on SDK controls (loaders, buttons, sheet chrome)
- `placeholder` on SDK-owned inputs
- `alert()` / `Alert.alert()` strings set by the SDK
- `headerTitle` passed by SDK components (not consumer props)

### Violation examples

```tsx
// ❌ Hardcoded Cancel
<Text>Cancel</Text>

// ✅ Localized
const { t } = useSdkTranslation()
<Text>{t('cancel')}</Text>
```

```tsx
// ❌ Hardcoded loader label
<ActivityIndicator accessibilityLabel="Loading" />

// ✅ Localized
<ActivityIndicator accessibilityLabel={t('loading')} />
```

```tsx
// ❌ Hardcoded sheet title set by the SDK
<NativeSheet headerTitle="Versions" />

// ✅ Localized (add key to platform-localization first)
<NativeSheet headerTitle={t('versions')} />
```

## Do not flag

- `packages/ui/src/dom/**` — in-WebView copy follows provider `locale` via the web SDK; DOM files must not grow their own i18n keys ([ADR 0019](../docs/adr/0019-provider-locale-crosses-dom-bridge.md))
- Test files (`__tests__/**`, `*.test.tsx`) asserting rendered English output
- Strings passed through from consumer props (e.g. `YouVersionAuthButton` `text` override)
- Non-user-facing literals (test IDs, log messages, style tokens, route names)

## Locale files are generated — do not hand-edit

Translation JSON under `packages/ui/src/i18n/locales/` (`en.json`, `es.json`, `fr.json`, and future locales) is **generated and synced** from [platform-localization](https://github.com/youversion/platform-localization). Do not add, edit, or remove string values in these files in a PR.

**Correct workflow:**

1. Add an unprefixed shared key in platform-localization `sources/common/en.json`. Use `reactnative.*` only when the string belongs to this SDK alone, and say why in `_comment`.
2. Merge the platform-localization PR; CI assembles `dist/reactnative/*.json`.
3. The **Distribute React Native Localization** workflow syncs assembled files into this repo.
4. After distribution adds locale JSON files, run `pnpm generate:locale-index` to refresh `packages/ui/src/i18n/locales/index.ts` (auto-generated; do not hand-edit).

Flag any PR diff that hand-edits locale JSON string values. Exception: automated localization sync PRs from the distribution workflow.

## Review checklist

1. Does the PR add or change user-visible native copy?
2. Is every new string backed by a platform-localization key (not a hand-edited locale JSON file)?
3. Are accessibility labels and hints localized?
4. Are SDK-owned sheet headers localized?
5. Is the change correctly scoped to native only (not DOM)?
6. Were locale JSON files left untouched (except sync PRs)?

## dom-versus-native

Web SDK components mount only inside an Expo DOM wrapper. A 'use dom' file outside packages/ui/src/dom/** is a finding. Allowed DOM entries are bible-reader.tsx, bible-text-view.tsx, and footnote-content.tsx. packages/ui/src/native/register-dom-impls.ts may register those entries. Native code may import Web SDK values. `BibleReader` and footnote sheets ship as native text. `dom/bible-reader.tsx` and `dom/footnote-content.tsx` remain for comparison and will be removed. `BibleTextView`, `BibleCard`, and `VerseOfTheDay` still use the DOM text view.

## nativesheet-test-seam

Layer-3 tests swap DOM, NativeSheet, and sibling sheets through stubImpl, setImpl, and resetImpls from packages/ui/src/test-utils/install-test-impls.tsx. Those helpers call setImpl on the registry in packages/ui/src/native/component-impls.ts. getImpl is exported from that registry, and production code reads an entry with it. Tests assert the bridge with latestDomProps. They do not mount 'use dom' in RNTL and they do not jest.mock app modules. packages/ui/jest.setup.js may shim native runtimes only.

## public-api-pin

A new package export is a finding unless packages/ui/src/__tests__/exports.test.ts or a core exports test already pins it. Allowed exports keys are "." and "./package.json" on both packages, plus "./sdk-version" on core only, per ADR 0011. UI primitives stay on packages/ui/src/components/ui/ and off src/index.ts.

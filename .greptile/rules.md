# Native UI localization (P0)

Applies to `packages/ui/src/native/**`. Full guide: [docs/contributing/native-i18n.md](../docs/contributing/native-i18n.md).

## Required pattern

- Call `useSdkTranslation()` and render copy with `t('key')` or `<Trans i18nKey="key">`.
- Add new keys under `reactnative.*` in [platform-localization](https://github.com/youversion/platform-localization) (`sources/common/en.json`). Keys are typed via `SdkTranslationKey` after sync.

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

- `packages/ui/src/dom/**` — DOM/WebView copy is English per [ADR 0009](../docs/adr/0009-deferred-dom-localization.md)
- Test files (`__tests__/**`, `*.test.tsx`) asserting rendered English output
- Strings passed through from consumer props (e.g. `YouVersionAuthButton` `text` override)
- Non-user-facing literals (test IDs, log messages, style tokens, route names)

## Locale files are generated — do not hand-edit

Translation JSON under `packages/ui/src/i18n/locales/` (`en.json`, `es.json`, `fr.json`, and future locales) is **generated and synced** from [platform-localization](https://github.com/youversion/platform-localization). Do not add, edit, or remove string values in these files in a PR.

**Correct workflow:**

1. Add the key under `reactnative.*` in platform-localization `sources/common/en.json`.
2. Merge the platform-localization PR; CI assembles `dist/reactnative/*.json`.
3. The **Distribute React Native Localization** workflow syncs assembled files into this repo.
4. Register new locale codes in `packages/ui/src/i18n/locales/index.ts` when distribution adds them (`index.ts` is hand-editable; locale JSON is not).

Flag any PR diff that hand-edits locale JSON string values. Exception: automated localization sync PRs from the distribution workflow.

## Review checklist

1. Does the PR add or change user-visible native copy?
2. Is every new string backed by a platform-localization key (not a hand-edited locale JSON file)?
3. Are accessibility labels and hints localized?
4. Are SDK-owned sheet headers localized?
5. Is the change correctly scoped to native only (not DOM)?
6. Were locale JSON files left untouched (except sync PRs)?

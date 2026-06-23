# Native UI localization (P0)

Applies to `packages/ui/src/native/**`. Full guide: [docs/contributing/native-i18n.md](../docs/contributing/native-i18n.md).

## Required pattern

- Call `useSdkTranslation()` and render copy with `t('key')` or `<Trans i18nKey="key">`.
- Add the key to `packages/ui/src/i18n/locales/en.json`. Keys are typed via `SdkTranslationKey`.

## Flag as high severity

Hardcoded user-visible English in:

- `<Text>` children owned by the SDK
- `accessibilityLabel` on SDK controls (loaders, buttons, sheet chrome)
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

// ✅ Localized (add key to en.json first)
<NativeSheet headerTitle={t('versions')} />
```

Known violations to catch on new/changed lines: `"Cancel"`, `"Loading"`, `"Books"`, `"Versions"`.

## Do not flag

- `packages/ui/src/dom/**` — DOM/WebView copy is English per [ADR 0009](../docs/adr/0009-deferred-dom-localization.md)
- Test files (`__tests__/**`, `*.test.tsx`) asserting rendered English output
- Strings passed through from consumer props (e.g. `YouVersionAuthButton` `text` override)
- Non-user-facing literals (test IDs, log messages, style tokens, route names)

## Review checklist

1. Does the PR add or change user-visible native copy?
2. Is every new string backed by an `en.json` key?
3. Are accessibility labels localized?
4. Are SDK-owned sheet headers localized?
5. Is the change correctly scoped to native only (not DOM)?

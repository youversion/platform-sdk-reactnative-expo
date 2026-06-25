# Native UI localization

How to add user-visible copy in `packages/ui/src/native/**` without hardcoding English.

## Scope

**In scope:** React Native UI the SDK owns — auth button labels, sheet headers, Cancel controls, loader accessibility labels, and any other copy rendered outside Expo DOM WebViews.

**Out of scope:**

- `packages/ui/src/dom/**` — WebView-hosted Bible UI stays English until a future DOM strategy ships ([ADR 0009](../adr/0009-deferred-dom-localization.md)).
- Consumer-provided prop values (e.g. `YouVersionAuthButton` `text` override).
- Test files asserting rendered output.

`YouVersionProvider locale` drives native strings only. It does not cross the DOM bridge and is not the same as Bible `versionId` / language picker state — see [ADR 0007](../adr/0007-app-locale-vs-bible-language-id.md) and [ADR 0008](../adr/0008-sdk-owned-i18next-no-consumer-overrides.md).

## Required pattern

1. Add the English string to `packages/ui/src/i18n/locales/en.json`.
2. Call `useSdkTranslation()` in the native component.
3. Render with `t('key')` or `<Trans i18nKey="key">` for rich text.

Keys are typed automatically: `SdkTranslationKey` is derived from `en.json`. Do not add parallel string constants.

### Simple label

```tsx
import { useSdkTranslation } from '../i18n/use-sdk-translation'

function SheetHeader({ onClose }: { onClose: () => void }) {
  const { t } = useSdkTranslation()

  return (
    <Pressable onPress={onClose} accessibilityRole="button">
      <Text>{t('cancel')}</Text>
    </Pressable>
  )
}
```

### Accessibility label

```tsx
<ActivityIndicator size="large" accessibilityLabel={t('loading')} />
```

### Rich text (bold segments)

Pass `i18n` from `useSdkTranslation()` to `<Trans>` — see `youversion-auth-button.tsx`:

```tsx
const { t, i18n } = useSdkTranslation()

<Trans
  i18n={i18n}
  i18nKey="signInWithYouVersion"
  parent={Text}
  components={{ bold: <Text style={{ fontWeight: 'bold' }} /> }}
/>
```

Matching entry in `en.json`:

```json
{
  "signInWithYouVersion": "Sign in with <bold>{{brandName}}</bold>"
}
```

### SDK-owned sheet headers

When the SDK sets `headerTitle` on `NativeSheet`, localize at the call site:

```tsx
const { t } = useSdkTranslation()

<NativeSheet headerTitle={t('versions')} ... />
```

Do not hardcode titles like `"Books"` or `"Versions"`.

## Common violations

| Hardcoded | Fix |
| --- | --- |
| `<Text>Cancel</Text>` | `{t('cancel')}` |
| `accessibilityLabel="Loading"` | `accessibilityLabel={t('loading')}` |
| `headerTitle="Books"` | `headerTitle={t('books')}` (add key first) |
| `headerTitle="Versions"` | `headerTitle={t('versions')}` (add key first) |

Greptile enforces this rule at **high** severity for `packages/ui/src/native/**` — see `.greptile/rules.md`.

## Test exceptions

Native screen tests may assert English output from the default locale. Hardcoded strings in `__tests__/**` and `*.test.tsx` are allowed when they:

- Set up props for components under test (e.g. `headerTitle="Versions"` on a harness)
- Assert rendered text matches `en.json` defaults

Do not copy production hardcoding patterns into non-test source files.

## Adding a new locale key

1. Add the key and English value to `packages/ui/src/i18n/locales/en.json`.
2. Use the key via `t('yourKey')` or `<Trans i18nKey="yourKey">`.
3. TypeScript will accept the key through `SdkTranslationKey` — no manual type updates.

Non-English locale files are not shipped yet; `en.json` is the canonical catalog.

## Related docs

- [ADR 0007 — App locale vs Bible languageId](../adr/0007-app-locale-vs-bible-language-id.md)
- [ADR 0008 — SDK-owned i18next](../adr/0008-sdk-owned-i18next-no-consumer-overrides.md)
- [ADR 0009 — Deferred DOM localization](../adr/0009-deferred-dom-localization.md)

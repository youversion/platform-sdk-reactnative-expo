# 21. Native design tokens are a hand-ported runtime copy of the web theme

Date: 2026-09-03

## Status

Accepted

## Context

Native chrome — sheets, buttons, pickers, prompts — carried hex literals in whatever component needed them. There was no shared source, so a color existed as many times as it was used and dark mode was decided per file. The Web SDK inside each Expo DOM WebView has its own theme and is unaffected by any of this.

The web theme is `theme.css` in `platform-sdk-react`: `oklch()` values under `:root` and `.dark`, sizes in `rem`. React Native parses neither. It also has no cascade — a `View` passes no text style to its children, so the web pattern of setting a color on a container and letting the label inherit it has no analog.

The SDK is moving off WebViews toward native rendering ([ADR 0020](0020-bible-content-cache-below-fetch.md)). Native chrome grows from here, so the styling layer under it is kept, not throwaway.

DS-1 through DS-7 built the layer: tokens (YPE-5264), `useTokens` (YPE-5265), brand fonts (YPE-5266), `createVariants` (YPE-5267), `Text` (YPE-5268), `Button` (YPE-5269), and Card. This ADR records what those tickets decided.

## Decision

**Web is a one-time source of truth, not a live dependency.** The values were read off `theme.css` once and written by hand into `theme/palette.ts` and `theme/semantic.ts` as `#rrggbb`. Nothing imports the web theme, and no `oklch()` is converted at runtime or in a build step. `theme/__tests__/tokens.test.ts` reads every file in `theme/` and fails on `oklch(`, `rgb(`, or `rem`, so a paste from the web repo cannot slip in. Alpha fills that web writes as `destructive/60` are built at the call site with `withAlpha`, which is why that helper lives in `lib/color.ts` and not in the token modules. A build step that generated these files was rejected: the value set changes a few times a year, and the cost of the generator outlives the cost of a re-port.

**Two layers, palette and semantic. No component tokens.** `palette` is named hex with no meaning attached. `semanticColors` assigns a role — `background`, `mutedForeground`, `border`, `wj` — once per scheme. A third component-level layer was rejected: a `buttonBackground` token has exactly one consumer, and the variant map in that component is a better place to read it. Button's control heights (`SIZES`) stay local for the same reason.

**Tokens resolve at JS runtime through `getTokens(scheme)`.** Two frozen `Tokens` objects are built at module load and returned by identity — `getTokens('light') === getTokens('light')`. Identity is a contract, not an optimization: `createVariants` caches its `StyleSheet` pieces in a `WeakMap` keyed on the tokens object, so a fresh object per call would rebuild every sheet on every render.

**One provider owns the scheme.** `YouVersionProvider` resolves `light | dark | system` against `useColorScheme` and publishes the result on `ThemeContext`; `useTokens()` is `getTokens(useTheme())`. There is no separate `ThemeProvider`. The resolved scheme already feeds the DOM bridge and `NativeSheet`, and a second provider is a second place for those three to disagree. Outside a provider the context default is light, so a primitive rendered in isolation — a test, a Storybook-style harness — paints rather than throws.

**`getTokens` and `useTokens` are public. The primitives are not.** A consumer styling their own chrome to sit next to ours needs the values, so both are on the package namespace. `Text`, `Button`, and the rest export only from the `components/ui/` barrel; `src/__tests__/exports.test.ts` pins the whole namespace, so an accidental re-export from `src/index.ts` reds the suite instead of silently becoming API.

**`createVariants` is a CVA-shaped resolver over `StyleSheet`, imported from `lib/variants` directly.** A factory takes tokens and returns `{ base, variants, defaultVariants }`; the resolver returns a style array, with a later group overriding a key an earlier group set. The import path is load-bearing: the `lib` barrel re-exports `dom-apply`, which imports `@youversion/platform-react-ui`, so importing `createVariants` through the barrel drags the Web SDK into the native bundle.

**Primitives are compounds that publish foreground through context.** `Object.assign(Root, { Slot })`, with a `useXContext()` that throws when a slot renders outside its root. This exists because RN inherits nothing: the root is the only place that knows which variant is active, so it resolves foreground and icon size once and publishes them, and `Button.Text` and `Button.Icon` read them instead of re-deriving the variant. `Button` is the reference implementation.

**Caller `style` merges after the variant styles; state styles merge last.** Pressed and disabled outrank a caller's `style` the way web's `disabled:` and `hover:` variants outrank a utility class. The alternative leaves a dead control looking live.

**Pragmatic scales only — radius, type, font family. No spacing scale.** The radius and type ramps came over because web has a real ramp for both. Spacing did not: the numbers in use are a handful of paddings and gaps that do not form a ladder yet. A step is added with the component that needs it, not ahead of it.

**`fontFamily` tokens are family names; weight is a registered face.** Brand faces load through the Fonts API inside `YouVersionProvider`, and each one registers under its own mapped name — `fontMapKey` builds `Untitled Serif_bold`, `Inter_medium`, and so on. RN selects those by naming the face, so a token-styled primitive reaches bold through `fontMapKey(family, 700, 'normal')` and never through `fontWeight: '700'`, which cannot address a face that is a separate family to the platform.

**That rule is scoped to the primitives.** Native sheet typography predates this layer and still sets `fontWeight` directly — `prompt-sheet.tsx`, `bible-verse-action-sheet.tsx`, `highlight-consent-sheet.tsx`, and the sheets beside them. It is correct there: none of them sets a `fontFamily`, so the text renders in the platform system face, which `fontWeight` does address. They move to `fontMapKey` when a sheet is rebuilt on the primitives, not before. These tokens do not cross the DOM bridge — reader fonts do, as quote-free encoded tokens, for the unrelated reason in [ADR 0009](0009-bridge-safe-font-tokens.md).

## Consequences

- Native chrome and the Web SDK inside a WebView track the same palette but drift independently. A `theme.css` change lands here only when someone re-ports it, and nothing detects the gap.
- A consumer can read tokens but cannot replace them. `theme` stays `light | dark | system`; there is no brand-override seam, and adding one later means deciding whether an override reaches the WebView too.
- Dark mode is a token swap plus a small, explicit exception list. Button's `scheme` group is that list today — the two places where web restyles under `dark:` beyond a color swap.
- Every consumer of `useTokens` re-renders when the scheme changes. Token identity is stable per scheme, so the variant sheets survive that render.
- Removing the WebViews does not touch this layer. It is the layer the replacements are built on.
- Padding and gap numbers stay in components until a second component wants the same ramp. That is the trigger to promote them, and until then two components can disagree.
- A new primitive has to be added to the `components/ui/` barrel and left out of `src/index.ts`, or the exports test fails. That failure is the intended behavior, not a nuisance to work around.

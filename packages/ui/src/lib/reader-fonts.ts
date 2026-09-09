/**
 * Mirrors the font-family constants in `@youversion/platform-react-ui`'s
 * `lib/verse-html-utils`, which are not currently re-exported from the
 * package's public entry. We need exact string-match parity so that
 * `BibleThemeSettingsContent`'s selected-button highlighting works when we
 * pass these values into the DOM wrapper.
 */
export const INTER_FONT = '"Inter", sans-serif' as const
export const UNTITLED_SERIF_FONT = '"Untitled Serif", "Source Serif 4", serif' as const

/**
 * Superseded by {@link UNTITLED_SERIF_FONT} in Web SDK 2.5.0, which swapped the
 * serif face to YouVersion's brand serif. Retained only so values persisted by
 * earlier versions still round-trip as a known token (they contain `"` and so
 * must not reach the bridge raw) and can be migrated — see
 * `reader-settings-store`.
 *
 * @deprecated
 */
export const SOURCE_SERIF_FONT = '"Source Serif 4", serif' as const

export type FontFamily =
  | typeof INTER_FONT
  | typeof UNTITLED_SERIF_FONT
  | typeof SOURCE_SERIF_FONT
  | (string & {})

/**
 * Quote-free identifiers used to carry the font family across the native <->
 * Expo DOM bridge.
 *
 * On iOS, `@expo/dom-webview` injects a component's initial props by embedding
 * the JSON inside a JS *template literal* (`return \`<json>\``). That template
 * literal un-escapes the `\"` that `JSON.stringify` produced, so any prop value
 * containing a `"` arrives as malformed JSON. The dev HTML wrapper's
 * `JSON.parse` then throws before it can set `window.$$EXPO_DOM_HOST_OS`, and
 * the component dies with "Top OS ($$EXPO_DOM_HOST_OS) is not defined" — i.e.
 * it renders blank. Known SDK stacks cross as these tokens. Every other stack
 * is URI-encoded so `"`, backticks, and `${` cannot break that injection. Both
 * resolve back inside the DOM component so the Web SDK still sees the original
 * CSS. Android is unaffected (its bridge returns the raw string), but we encode
 * on both platforms for a single code path. See
 * `docs/adr/0009-bridge-safe-font-tokens.md`.
 */
export const FONT_FAMILY_TOKEN = {
  INTER: 'inter',
  UNTITLED_SERIF: 'untitled-serif',
  SOURCE_SERIF: 'source-serif',
} as const

export type FontFamilyToken =
  | (typeof FONT_FAMILY_TOKEN)[keyof typeof FONT_FAMILY_TOKEN]
  | (string & {})

const FONT_FAMILY_TO_TOKEN = {
  [INTER_FONT]: FONT_FAMILY_TOKEN.INTER,
  [UNTITLED_SERIF_FONT]: FONT_FAMILY_TOKEN.UNTITLED_SERIF,
  [SOURCE_SERIF_FONT]: FONT_FAMILY_TOKEN.SOURCE_SERIF,
} satisfies Record<string, FontFamilyToken>

const TOKEN_TO_FONT_FAMILY = {
  [FONT_FAMILY_TOKEN.INTER]: INTER_FONT,
  [FONT_FAMILY_TOKEN.UNTITLED_SERIF]: UNTITLED_SERIF_FONT,
  [FONT_FAMILY_TOKEN.SOURCE_SERIF]: SOURCE_SERIF_FONT,
} satisfies Record<string, FontFamily>

/**
 * Prefix for a URI-encoded custom stack. `encodeURIComponent` turns `"`,
 * backticks, and `${` into percent-escapes, which are safe in the iOS
 * template-literal injection.
 */
const QUOTED_FONT_PREFIX = 'quoted:'

function encodeQuotedFontFamily(fontFamily: string): FontFamilyToken {
  return `${QUOTED_FONT_PREFIX}${encodeURIComponent(fontFamily)}`
}

function decodeQuotedFontFamily(token: string): FontFamily | undefined {
  if (!token.startsWith(QUOTED_FONT_PREFIX)) return undefined
  try {
    return decodeURIComponent(token.slice(QUOTED_FONT_PREFIX.length))
  } catch {
    return undefined
  }
}

function tokenForFontFamily(fontFamily: FontFamily): FontFamilyToken | undefined {
  switch (fontFamily) {
    case INTER_FONT:
      return FONT_FAMILY_TO_TOKEN[INTER_FONT]
    case UNTITLED_SERIF_FONT:
      return FONT_FAMILY_TO_TOKEN[UNTITLED_SERIF_FONT]
    case SOURCE_SERIF_FONT:
      return FONT_FAMILY_TO_TOKEN[SOURCE_SERIF_FONT]
    default:
      return undefined
  }
}

function fontFamilyForToken(token: FontFamilyToken): FontFamily | undefined {
  switch (token) {
    case FONT_FAMILY_TOKEN.INTER:
      return TOKEN_TO_FONT_FAMILY[FONT_FAMILY_TOKEN.INTER]
    case FONT_FAMILY_TOKEN.UNTITLED_SERIF:
      return TOKEN_TO_FONT_FAMILY[FONT_FAMILY_TOKEN.UNTITLED_SERIF]
    case FONT_FAMILY_TOKEN.SOURCE_SERIF:
      return TOKEN_TO_FONT_FAMILY[FONT_FAMILY_TOKEN.SOURCE_SERIF]
    default:
      return undefined
  }
}

/**
 * Encode a font family into a bridge-safe value before it crosses into an Expo
 * DOM component's props. Known SDK stacks become tokens. Every other stack is
 * URI-encoded so template-literal hazards cannot reach the iOS injection.
 */
export function encodeFontFamilyForDom(fontFamily: FontFamily): FontFamilyToken {
  return tokenForFontFamily(fontFamily) ?? encodeQuotedFontFamily(fontFamily)
}

/**
 * Decode a bridge token received inside an Expo DOM component back into the
 * font family the Web SDK expects. Inverse of {@link encodeFontFamilyForDom}.
 * Known tokens become canonical stacks. Quoted custom encodings restore the
 * original stack. Other unknown values pass through unchanged.
 */
export function decodeFontFamilyFromDom(
  token: FontFamilyToken | undefined,
): FontFamily | undefined {
  if (token == null) return token
  return fontFamilyForToken(token) ?? decodeQuotedFontFamily(token) ?? token
}

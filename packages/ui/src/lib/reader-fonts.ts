/**
 * Mirrors the font-family constants in `@youversion/platform-react-ui`'s
 * `lib/verse-html-utils`, which are not currently re-exported from the
 * package's public entry. We need exact string-match parity so that
 * `BibleThemeSettingsContent`'s selected-button highlighting works when we
 * pass these values into the DOM wrapper.
 */
export const INTER_FONT = '"Inter", sans-serif' as const
export const SOURCE_SERIF_FONT = '"Source Serif 4", serif' as const

export type FontFamily =
  | typeof INTER_FONT
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
 * it renders blank. The CSS font stacks above are the only SDK props that
 * contain a `"`, so we cross the bridge as these tokens and resolve back to the
 * canonical string (which must byte-match the Web SDK) inside the DOM
 * component. Android is unaffected (its bridge returns the raw string), but we
 * encode on both platforms for a single code path. See
 * `docs/adr/0009-bridge-safe-font-tokens.md`.
 */
export const FONT_FAMILY_TOKEN = {
  INTER: 'inter',
  SOURCE_SERIF: 'source-serif',
} as const

export type FontFamilyToken =
  | (typeof FONT_FAMILY_TOKEN)[keyof typeof FONT_FAMILY_TOKEN]
  | (string & {})

const FONT_FAMILY_TO_TOKEN: Record<string, FontFamilyToken> = {
  [INTER_FONT]: FONT_FAMILY_TOKEN.INTER,
  [SOURCE_SERIF_FONT]: FONT_FAMILY_TOKEN.SOURCE_SERIF,
}

const TOKEN_TO_FONT_FAMILY: Record<string, FontFamily> = {
  [FONT_FAMILY_TOKEN.INTER]: INTER_FONT,
  [FONT_FAMILY_TOKEN.SOURCE_SERIF]: SOURCE_SERIF_FONT,
}

/**
 * Encode a canonical font family into its bridge-safe token before it crosses
 * into an Expo DOM component's props. Unknown values (e.g. a consumer-supplied
 * custom stack) pass through unchanged.
 */
export function encodeFontFamilyForDom(fontFamily: FontFamily): FontFamilyToken
export function encodeFontFamilyForDom(
  fontFamily: FontFamily | undefined,
): FontFamilyToken | undefined
export function encodeFontFamilyForDom(
  fontFamily: FontFamily | undefined,
): FontFamilyToken | undefined {
  if (fontFamily == null) return fontFamily
  return FONT_FAMILY_TO_TOKEN[fontFamily] ?? fontFamily
}

/**
 * Decode a bridge token received inside an Expo DOM component back into the
 * canonical font family the Web SDK expects. Inverse of
 * {@link encodeFontFamilyForDom}; unknown values pass through unchanged.
 */
export function decodeFontFamilyFromDom(token: FontFamilyToken): FontFamily
export function decodeFontFamilyFromDom(
  token: FontFamilyToken | undefined,
): FontFamily | undefined
export function decodeFontFamilyFromDom(
  token: FontFamilyToken | undefined,
): FontFamily | undefined {
  if (token == null) return token
  return TOKEN_TO_FONT_FAMILY[token] ?? token
}

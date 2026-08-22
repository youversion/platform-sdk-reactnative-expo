import pkg from '../../package.json'

// Single source of truth for the SDK version reported in the `x-yvp-sdk`
// header. `package.json` is the only place the version lives; this file varies
// a suffix by build channel so the data lake can separate internal dev-time
// traffic (`ReactNativeSDK=0.9.0-dev`) from published partner traffic
// (`ReactNativeSDK=0.9.0`), while dev traffic keeps its version line.
//
// The telemetry rule is `value.endsWith('-dev')`, matching the Web SDK
// (platform-sdk-react ADR 0002). See docs/adr/0012-sdk-version-stamp-on-publish.md.

// STAMP anchor: `true` only in builds produced for publishing. Source, dev, and
// test builds leave it `false`, so their traffic carries the `-dev` suffix. On
// publish, `scripts/stamp-sdk-version.cjs` flips this literal to `true` in the
// COMPILED `build/` copy of this file (after `expo-module build`); source is
// never touched, so dev keeps reporting `-dev`.
//
// Keep it a lone `= false` assignment: the stamp matches that exact text and
// fails the publish if it is missing or duplicated.
const IS_PUBLISH_BUILD = false

export const SDK_VERSION: string = IS_PUBLISH_BUILD ? pkg.version : `${pkg.version}-dev`

// Same name platform-core 2.8.0 writes. A lowercase `x-yvp-sdk` is a
// different object key and `Headers` would combine both values.
const SDK_HEADER_NAME = 'X-YVP-Sdk'

export type SdkHeaders = {
  'X-YVP-Sdk': string
}

export function getSdkHeaders(): SdkHeaders {
  return { [SDK_HEADER_NAME]: `ReactNativeSDK=${SDK_VERSION}` } satisfies SdkHeaders
}

export function mergeSdkHeaders(additionalHeaders?: Record<string, string>): SdkHeaders {
  const rest = Object.fromEntries(
    Object.entries(additionalHeaders ?? {}).filter(
      ([key]) => key.toLowerCase() !== SDK_HEADER_NAME.toLowerCase(),
    ),
  )
  return { ...rest, ...getSdkHeaders() } satisfies SdkHeaders
}

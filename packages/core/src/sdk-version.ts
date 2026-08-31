import pkg from '../package.json'

// `x-yvp-sdk` build-channel stamp: dev traffic reports `<version>-dev`,
// published builds `<version>` (telemetry filters on endsWith('-dev')).
// See docs/adr/0012-sdk-version-stamp-on-publish.md and ADR 0020.

// Keep this a lone `= false` assignment: scripts/stamp-sdk-version.cjs flips
// the exact text in the compiled build/sdk-version.js on publish and fails the
// publish if the anchor is missing or duplicated.
const IS_PUBLISH_BUILD = false

export const SDK_VERSION: string = IS_PUBLISH_BUILD ? pkg.version : `${pkg.version}-dev`

// Same casing platform-core writes; a lowercase key would be a second header.
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

import * as Application from 'expo-application'

/**
 * The integrating app's display name, interpolated into the sign-in sheet's
 * `signInParagraph` ("{appName} wants to connect to your YouVersion Bible App
 * account…"). Reads the iOS display name / Android app label via
 * `expo-application`, so consumers configure nothing.
 *
 * `null` when the platform reports no name (in practice, only web). Callers
 * interpolate an empty string rather than an untranslatable English default.
 */
export function resolveAppName(): string | null {
  const name = Application.applicationName
  if (typeof name !== 'string') {
    return null
  }
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : null
}

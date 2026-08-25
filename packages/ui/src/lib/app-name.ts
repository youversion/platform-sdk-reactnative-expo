import * as Application from 'expo-application'
import { z } from 'zod'

/**
 * The integrating app's display name, interpolated into the sign-in sheet's
 * `signInParagraph` ("{appName} wants to connect to your YouVersion Bible App
 * account…"). `expo-application` reads the iOS display name or the Android app
 * label, so consumers configure nothing.
 *
 * Returns `null` when the platform reports no name, which in practice is only
 * web. Callers interpolate an empty string instead of an untranslatable English
 * default.
 */
const appNameSchema = z.string().trim().min(1)

export function resolveAppName(): string | null {
  const parsed = appNameSchema.safeParse(Application.applicationName)
  return parsed.success ? parsed.data : null
}

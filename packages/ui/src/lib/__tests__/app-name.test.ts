import * as Application from 'expo-application'

import { resolveAppName } from '../app-name'

jest.mock('expo-application', () => ({ applicationName: 'Test App' }))

const application = Application as { applicationName: string | null }

describe('resolveAppName', () => {
  it('returns the app’s display name', () => {
    application.applicationName = 'Bible Study'

    expect(resolveAppName()).toBe('Bible Study')
  })

  it('trims surrounding whitespace', () => {
    application.applicationName = '  Bible Study  '

    expect(resolveAppName()).toBe('Bible Study')
  })

  it('returns null rather than an untranslatable English fallback when unavailable', () => {
    // `expo-application` reports null on web, where the sign-in sheet never
    // renders. Callers interpolate an empty name rather than shipping a
    // hardcoded default.
    application.applicationName = null

    expect(resolveAppName()).toBeNull()
  })

  it('treats a blank name as unavailable', () => {
    application.applicationName = '   '

    expect(resolveAppName()).toBeNull()
  })
})

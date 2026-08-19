import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import type { ReactNode } from 'react'

import * as AuthProviderModule from '../auth/auth-provider'
import * as DrainHostModule from '../highlights/highlight-queue-drain-host'
import * as installationId from '../installation-id'
import { useYouVersion } from '../use-youversion'
import YouVersionProvider from '../youversion-provider'

beforeEach(() => {
  jest.spyOn(installationId, 'getOrSetInstallationId').mockReturnValue('inst-1')
  jest
    .spyOn(AuthProviderModule, 'AuthProvider')
    .mockImplementation(({ children }: { children?: ReactNode }) => children)
  jest.spyOn(DrainHostModule, 'HighlightQueueDrainHost').mockImplementation(() => null)
})

afterEach(() => {
  jest.restoreAllMocks()
})

function ContextPeek() {
  const ctx = useYouVersion()
  return <Text testID="ctx">{JSON.stringify(ctx)}</Text>
}

describe('YouVersionProvider', () => {
  it.each([
    ['with custom apiHost', { apiHost: 'api.custom.com' }, 'api.custom.com'],
    ['with default apiHost', {}, 'api.youversion.com'],
  ])('provides context to children immediately (%s)', (_label, props, expectedHost) => {
    render(
      <YouVersionProvider appKey="appkey" {...props}>
        <ContextPeek />
      </YouVersionProvider>,
    )

    expect(JSON.parse(screen.getByTestId('ctx').props.children)).toEqual({
      installationId: 'inst-1',
      appKey: 'appkey',
      apiHost: expectedHost,
    })
  })

  it('wraps children in AuthProvider when an auth config is provided', () => {
    const auth = { redirectUri: 'https://app/cb' }

    render(
      <YouVersionProvider appKey="appkey" auth={auth}>
        <Text testID="content">Content</Text>
      </YouVersionProvider>,
    )

    expect(screen.getByTestId('content')).toBeTruthy()
    expect(AuthProviderModule.AuthProvider).toHaveBeenCalledWith(
      expect.objectContaining({ config: auth, appKey: 'appkey', apiHost: 'api.youversion.com' }),
      undefined,
    )
  })

  it('does not mount AuthProvider when auth is omitted', () => {
    render(
      <YouVersionProvider appKey="appkey">
        <Text testID="content">Content</Text>
      </YouVersionProvider>,
    )

    expect(screen.getByTestId('content')).toBeTruthy()
    expect(AuthProviderModule.AuthProvider).not.toHaveBeenCalled()
    // No auth means no user, so there can be no queue to drain.
    expect(DrainHostModule.HighlightQueueDrainHost).not.toHaveBeenCalled()
  })

  it('mounts the highlight queue drain alongside AuthProvider', () => {
    render(
      <YouVersionProvider appKey="appkey" auth={{ redirectUri: 'app://callback' }}>
        <Text testID="content">Content</Text>
      </YouVersionProvider>,
    )

    expect(screen.getByTestId('content')).toBeTruthy()
    expect(DrainHostModule.HighlightQueueDrainHost).toHaveBeenCalled()
  })
})

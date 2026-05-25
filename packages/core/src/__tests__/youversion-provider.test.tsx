jest.mock('../installation-id', () => ({
  getOrSetInstallationId: jest.fn(),
}))

jest.mock('../auth/auth-provider', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: React.ReactNode }) => children),
}))

import { render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import AuthProvider from '../auth/auth-provider'
import { getOrSetInstallationId } from '../installation-id'
import { useYouVersion } from '../use-youversion'
import YouVersionProvider from '../youversion-provider'

const mockGetOrSetInstallationId = getOrSetInstallationId as jest.Mock
const MockAuthProvider = AuthProvider as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

function ContextPeek() {
  const ctx = useYouVersion()
  return <Text testID="ctx">{JSON.stringify(ctx)}</Text>
}

describe('YouVersionProvider', () => {
  it('renders fallback while installationId is resolving', () => {
    mockGetOrSetInstallationId.mockReturnValue(new Promise(() => {}))

    render(
      <YouVersionProvider appKey="appkey" fallback={<Text testID="loading">Loading</Text>}>
        <Text testID="content">Content</Text>
      </YouVersionProvider>,
    )

    expect(screen.getByTestId('loading')).toBeTruthy()
    expect(screen.queryByTestId('content')).toBeNull()
  })

  it.each([
    ['with custom apiHost', { apiHost: 'api.custom.com' }, 'api.custom.com'],
    ['with default apiHost', {}, 'api.youversion.com'],
  ])('provides context to children once installationId resolves (%s)', async (_label, props, expectedHost) => {
    mockGetOrSetInstallationId.mockResolvedValue('inst-1')

    render(
      <YouVersionProvider appKey="appkey" {...props}>
        <ContextPeek />
      </YouVersionProvider>,
    )

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('ctx').props.children)).toEqual({
        installationId: 'inst-1',
        appKey: 'appkey',
        apiHost: expectedHost,
      })
    })
  })

  it('wraps children in AuthProvider when an auth config is provided', async () => {
    mockGetOrSetInstallationId.mockResolvedValue('inst-1')
    const auth = { redirectUri: 'https://app/cb' }

    render(
      <YouVersionProvider appKey="appkey" auth={auth}>
        <Text testID="content">Content</Text>
      </YouVersionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('content')).toBeTruthy())
    expect(MockAuthProvider).toHaveBeenCalledWith(
      expect.objectContaining({ config: auth, appKey: 'appkey', apiHost: 'api.youversion.com' }),
      undefined,
    )
  })

  it('does not mount AuthProvider when auth is omitted', async () => {
    mockGetOrSetInstallationId.mockResolvedValue('inst-1')

    render(
      <YouVersionProvider appKey="appkey">
        <Text testID="content">Content</Text>
      </YouVersionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('content')).toBeTruthy())
    expect(MockAuthProvider).not.toHaveBeenCalled()
  })

  it('logs the error and stays in fallback if getOrSetInstallationId rejects', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGetOrSetInstallationId.mockRejectedValue(new Error('id fetch failed'))

    render(
      <YouVersionProvider appKey="appkey" fallback={<Text testID="loading">Loading</Text>}>
        <Text testID="content">Content</Text>
      </YouVersionProvider>,
    )

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load installationId:', expect.any(Error))
    })
    expect(screen.getByTestId('loading')).toBeTruthy()
    expect(screen.queryByTestId('content')).toBeNull()
    consoleSpy.mockRestore()
  })
})

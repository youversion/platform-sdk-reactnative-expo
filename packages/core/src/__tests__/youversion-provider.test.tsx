import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import AuthProvider from '../auth/auth-provider'
import HighlightQueueDrainHost from '../highlights/highlight-queue-drain-host'
import { getOrSetInstallationId } from '../installation-id'
import { useYouVersion } from '../use-youversion'
import YouVersionProvider from '../youversion-provider'

jest.mock('../installation-id', () => ({
  getOrSetInstallationId: jest.fn(),
}))

jest.mock('../auth/auth-provider', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: React.ReactNode }) => children),
}))

jest.mock('../highlights/highlight-queue-drain-host', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}))

const mockGetOrSetInstallationId = getOrSetInstallationId as jest.Mock
const MockAuthProvider = AuthProvider as unknown as jest.Mock
const MockDrainHost = HighlightQueueDrainHost as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockGetOrSetInstallationId.mockReturnValue('inst-1')
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
    expect(MockAuthProvider).toHaveBeenCalledWith(
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
    expect(MockAuthProvider).not.toHaveBeenCalled()
    // No auth means no user, so there can be no queue to drain.
    expect(MockDrainHost).not.toHaveBeenCalled()
  })

  it('mounts the highlight queue drain alongside AuthProvider', async () => {
    mockGetOrSetInstallationId.mockResolvedValue('inst-1')

    render(
      <YouVersionProvider appKey="appkey" auth={{ redirectUri: 'app://callback' }}>
        <Text testID="content">Content</Text>
      </YouVersionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('content')).toBeTruthy())
    expect(MockDrainHost).toHaveBeenCalled()
  })
})

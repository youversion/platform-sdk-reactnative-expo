import { act, renderHook, waitFor } from '@testing-library/react-native'
import type {
  BibleContentResponse,
  FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'

import { usePassage } from '../use-passage'

const VALID_BODY = JSON.stringify({
  content:
    '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>In the beginning</div></div>',
  reference: 'Genesis 1',
})

function respond(status: number, body = ''): FetchBibleContent {
  return jest.fn(
    async (): Promise<BibleContentResponse> => ({ status, body, contentType: 'application/json' }),
  )
}

function renderPassage(fetchBibleContent: FetchBibleContent) {
  return renderHook(() => usePassage(fetchBibleContent, 111, 'GEN', '1', true))
}

async function settled(fetchBibleContent: FetchBibleContent) {
  const hook = renderPassage(fetchBibleContent)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('usePassage', () => {
  it('sets the passage and no error on a 200 with a valid body', async () => {
    const { result } = await settled(respond(200, VALID_BODY))
    expect(result.current.error).toBeNull()
    expect(result.current.passage).toMatchObject({ key: '111:GEN.1', reference: 'Genesis 1' })
  })

  it.each([403, 404])('reports %i as unavailable', async (status) => {
    const { result } = await settled(respond(status))
    expect(result.current.error).toBe('unavailable')
    expect(result.current.passage).toBeNull()
  })

  it.each([401, 429, 503])('reports %i as failed, not unavailable', async (status) => {
    const { result } = await settled(respond(status))
    expect(result.current.error).toBe('failed')
  })

  it.each([
    ['invalid JSON', '<html>'],
    ['a body missing content', JSON.stringify({ reference: 'Genesis 1' })],
  ])('reports a 200 with %s as failed', async (_label, body) => {
    const { result } = await settled(respond(200, body))
    expect(result.current.error).toBe('failed')
  })

  it('reports a rejected fetch as offline', async () => {
    const fetchBibleContent: FetchBibleContent = jest.fn(async () => {
      throw new TypeError('Network request failed')
    })
    const { result } = await settled(fetchBibleContent)
    expect(result.current.error).toBe('offline')
  })

  it('refetches on retry() and clears the error once it loads', async () => {
    const fetchBibleContent = jest
      .fn<Promise<BibleContentResponse>, Parameters<FetchBibleContent>>()
      .mockResolvedValueOnce({ status: 503, body: '', contentType: null })
      .mockResolvedValueOnce({ status: 200, body: VALID_BODY, contentType: 'application/json' })
    const { result } = await settled(fetchBibleContent)
    expect(result.current.error).toBe('failed')

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.passage).not.toBeNull())
    expect(fetchBibleContent).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
  })
})

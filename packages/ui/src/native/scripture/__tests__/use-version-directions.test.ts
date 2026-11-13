import { act, renderHook, waitFor } from '@testing-library/react-native'
import type {
  BibleContentResponse,
  FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'

import { useVersionDirections } from '../use-version-directions'

function respond(status: number, body = ''): FetchBibleContent {
  return jest.fn(
    async (): Promise<BibleContentResponse> => ({ status, body, contentType: 'application/json' }),
  )
}

describe('useVersionDirections', () => {
  function renderDirections(fetchBibleContent: FetchBibleContent, versionId: number) {
    return renderHook(({ id }: { id: number }) => useVersionDirections(fetchBibleContent, id), {
      initialProps: { id: versionId },
    })
  }

  it("records the index's direction under its version and keeps it after a switch", async () => {
    const fetchBibleContent: FetchBibleContent = jest.fn(async ({ path }) => ({
      status: 200,
      body: JSON.stringify({ text_direction: path.includes('/187/') ? 'rtl' : 'ltr' }),
      contentType: 'application/json',
    }))
    const hook = renderDirections(fetchBibleContent, 187)
    await waitFor(() => expect(hook.result.current.get(187)).toBe('rtl'))
    expect(fetchBibleContent).toHaveBeenCalledWith({ path: '/v1/bibles/187/index' })

    hook.rerender({ id: 1887 })
    expect(hook.result.current.get(1887)).toBeUndefined()
    await waitFor(() => expect(hook.result.current.get(1887)).toBe('ltr'))
    expect(hook.result.current.get(187)).toBe('rtl')
  })

  it('does not fetch a known version again', async () => {
    const fetchBibleContent = respond(200, JSON.stringify({ text_direction: 'rtl' }))
    const hook = renderDirections(fetchBibleContent, 187)
    await waitFor(() => expect(hook.result.current.get(187)).toBe('rtl'))
    hook.rerender({ id: 187 })
    expect(fetchBibleContent).toHaveBeenCalledTimes(1)
  })

  it('shares one index fetch across hook instances for the same client and version', async () => {
    const fetchBibleContent = respond(200, JSON.stringify({ text_direction: 'rtl' }))
    const first = renderHook(() => useVersionDirections(fetchBibleContent, 187))
    const second = renderHook(() => useVersionDirections(fetchBibleContent, 187))
    await waitFor(() => {
      expect(first.result.current.get(187)).toBe('rtl')
      expect(second.result.current.get(187)).toBe('rtl')
    })
    expect(fetchBibleContent).toHaveBeenCalledTimes(1)
    first.unmount()
    second.unmount()
  })

  it('retries the index after a rejected fetch on a later mount', async () => {
    const fetchBibleContent: FetchBibleContent = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ text_direction: 'rtl' }),
        contentType: 'application/json',
      })
    const first = renderHook(() => useVersionDirections(fetchBibleContent, 187))
    await waitFor(() => expect(fetchBibleContent).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(first.result.current.size).toBe(0)
    first.unmount()

    const second = renderHook(() => useVersionDirections(fetchBibleContent, 187))
    await waitFor(() => expect(second.result.current.get(187)).toBe('rtl'))
    expect(fetchBibleContent).toHaveBeenCalledTimes(2)
  })

  it('does not fetch when disabled', async () => {
    const fetchBibleContent = respond(200, JSON.stringify({ text_direction: 'rtl' }))
    renderHook(() => useVersionDirections(fetchBibleContent, 187, { enabled: false }))
    await act(async () => {})
    expect(fetchBibleContent).not.toHaveBeenCalled()
  })

  it.each([
    ['a failed request', respond(503)],
    ['invalid JSON', respond(200, '<html>')],
    ['no direction', respond(200, JSON.stringify({ books: [] }))],
    ['an unknown direction', respond(200, JSON.stringify({ text_direction: 'ttb' }))],
    [
      'a rejected request',
      jest.fn(async (): Promise<BibleContentResponse> => {
        throw new Error('offline')
      }),
    ],
  ])('leaves the version with no entry on %s', async (_label, fetchBibleContent) => {
    const hook = renderDirections(fetchBibleContent, 187)
    await waitFor(() => expect(fetchBibleContent).toHaveBeenCalled())
    await act(async () => {})
    expect(hook.result.current.size).toBe(0)
  })
})

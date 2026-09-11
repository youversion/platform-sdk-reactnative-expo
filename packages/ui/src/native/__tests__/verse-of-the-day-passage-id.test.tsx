/**
 * Layer 1 — VOTD passage lookup for paint-only Highlight Scope.
 *
 * Native wrappers subscribe at chapter scope from this passage_id. The lookup
 * is internal; the wrapper is internal, same rule as `createHighlightsApi`.
 * No access token: VOTD is not a user-owned resource.
 */
import { BibleClient } from '@youversion/platform-core'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { useVerseOfTheDayPassageId } from '../use-verse-of-the-day-passage-id'
import { getVerseOfTheDayPassageId } from '../verse-of-the-day-api'

const credentials = {
  appKey: 'appkey',
  apiHost: 'api.example.com',
  installationId: 'inst-1',
}

const getVOTD = jest.spyOn(BibleClient.prototype, 'getVOTD')

beforeEach(() => {
  getVOTD.mockReset()
})

afterAll(() => {
  getVOTD.mockRestore()
})

describe('getVerseOfTheDayPassageId', () => {
  it('returns the passage_id when the lookup succeeds', async () => {
    getVOTD.mockResolvedValue({ day: 15, passage_id: 'JHN.3.16' })

    await expect(getVerseOfTheDayPassageId(credentials, 15)).resolves.toBe('JHN.3.16')
    expect(getVOTD).toHaveBeenCalledTimes(1)
    expect(getVOTD).toHaveBeenCalledWith(15)
  })

  it('returns null when the lookup fails', async () => {
    getVOTD.mockRejectedValue(new Error('network'))

    await expect(getVerseOfTheDayPassageId(credentials, 15)).resolves.toBeNull()
  })

  it('never passes an access token', async () => {
    getVOTD.mockResolvedValue({ day: 15, passage_id: 'JHN.3.16' })

    await getVerseOfTheDayPassageId(credentials, 15)

    expect(getVOTD.mock.calls[0]).toEqual([15])
    expect(getVOTD.mock.calls[0]).toHaveLength(1)
  })
})

describe('useVerseOfTheDayPassageId', () => {
  it('returns the passage_id once the lookup succeeds', async () => {
    getVOTD.mockResolvedValue({ day: 15, passage_id: 'JHN.3.16' })

    const { result } = renderHook(() => useVerseOfTheDayPassageId(15), { wrapper: wrapper() })

    expect(result.current.status).toBe('loading')
    expect(result.current.passageId).toBeNull()
    await waitFor(() => {
      expect(result.current.passageId).toBe('JHN.3.16')
    })
    expect(result.current.status).toBe('ready')
    expect(getVOTD).toHaveBeenCalledWith(15)
  })

  it('reports failed when the lookup fails', async () => {
    getVOTD.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useVerseOfTheDayPassageId(15), { wrapper: wrapper() })

    expect(result.current.status).toBe('loading')
    await waitFor(() => {
      expect(result.current.status).toBe('failed')
    })
    expect(result.current.passageId).toBeNull()
  })

  it('refetches when retry is called after a failed lookup', async () => {
    let resolveRetry: (value: { day: number; passage_id: string }) => void
    getVOTD.mockRejectedValueOnce(new Error('network'))
    getVOTD.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRetry = resolve
        }),
    )

    const { result } = renderHook(() => useVerseOfTheDayPassageId(15), { wrapper: wrapper() })

    await waitFor(() => {
      expect(result.current.status).toBe('failed')
    })

    await act(async () => {
      result.current.retry()
    })
    expect(result.current.status).toBe('loading')

    await act(async () => {
      resolveRetry({ day: 15, passage_id: 'JHN.3.16' })
    })
    expect(result.current.passageId).toBe('JHN.3.16')
    expect(result.current.status).toBe('ready')
    expect(getVOTD).toHaveBeenCalledTimes(2)
  })

  it('returns loading for the new day until that lookup resolves', async () => {
    getVOTD.mockResolvedValueOnce({ day: 15, passage_id: 'JHN.3.16' })
    getVOTD.mockResolvedValueOnce({ day: 16, passage_id: 'MAT.5.1' })

    const { result, rerender } = renderHook(
      ({ dayOfYear }: { dayOfYear: number }) => useVerseOfTheDayPassageId(dayOfYear),
      { wrapper: wrapper(), initialProps: { dayOfYear: 15 } },
    )

    await waitFor(() => {
      expect(result.current.passageId).toBe('JHN.3.16')
    })

    rerender({ dayOfYear: 16 })
    expect(result.current.status).toBe('loading')
    expect(result.current.passageId).toBeNull()

    await waitFor(() => {
      expect(result.current.passageId).toBe('MAT.5.1')
    })
    expect(getVOTD).toHaveBeenLastCalledWith(16)
  })
})

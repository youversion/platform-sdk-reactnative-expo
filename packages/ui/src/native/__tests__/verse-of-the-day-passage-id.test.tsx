/**
 * Layer 1 — VOTD passage lookup for paint-only Highlight Scope.
 *
 * Native wrappers subscribe at chapter scope from this passage_id. The lookup
 * is internal; the wrapper is internal, same rule as `createHighlightsApi`.
 * No access token: VOTD is not a user-owned resource.
 */
import { BibleClient } from '@youversion/platform-core'
import { renderHook, waitFor } from '@testing-library/react-native'

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

    expect(result.current).toBeNull()
    await waitFor(() => {
      expect(result.current).toBe('JHN.3.16')
    })
    expect(getVOTD).toHaveBeenCalledWith(15)
  })

  it('stays null when the lookup fails', async () => {
    getVOTD.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useVerseOfTheDayPassageId(15), { wrapper: wrapper() })

    expect(result.current).toBeNull()
    await waitFor(() => {
      expect(getVOTD).toHaveBeenCalled()
    })
    expect(result.current).toBeNull()
  })

  it('returns null for the new day until that lookup resolves', async () => {
    getVOTD.mockResolvedValueOnce({ day: 15, passage_id: 'JHN.3.16' })
    getVOTD.mockResolvedValueOnce({ day: 16, passage_id: 'MAT.5.1' })

    const { result, rerender } = renderHook(
      ({ dayOfYear }: { dayOfYear: number }) => useVerseOfTheDayPassageId(dayOfYear),
      { wrapper: wrapper(), initialProps: { dayOfYear: 15 } },
    )

    await waitFor(() => {
      expect(result.current).toBe('JHN.3.16')
    })

    rerender({ dayOfYear: 16 })
    expect(result.current).toBeNull()

    await waitFor(() => {
      expect(result.current).toBe('MAT.5.1')
    })
    expect(getVOTD).toHaveBeenLastCalledWith(16)
  })
})

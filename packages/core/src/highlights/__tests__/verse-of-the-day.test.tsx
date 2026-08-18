/**
 * Layer 1 — VOTD passage lookup for paint-only Highlight Scope.
 *
 * Native wrappers subscribe at chapter scope from this passage_id. The lookup
 * is public-API only as `useVerseOfTheDayPassageId`; the wrapper is internal,
 * same rule as `createHighlightsApi`. No access token: VOTD is not a
 * user-owned resource.
 */
import { BibleClient } from '@youversion/platform-core'
import { renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { YouVersionContext } from '../../youversion-context'
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

    await expect(getVerseOfTheDayPassageId(credentials)).resolves.toBe('JHN.3.16')
    expect(getVOTD).toHaveBeenCalledTimes(1)
    expect(getVOTD).toHaveBeenCalledWith(expect.any(Number))
  })

  it('returns null when the lookup fails', async () => {
    getVOTD.mockRejectedValue(new Error('network'))

    await expect(getVerseOfTheDayPassageId(credentials)).resolves.toBeNull()
  })

  it('never passes an access token', async () => {
    getVOTD.mockResolvedValue({ day: 15, passage_id: 'JHN.3.16' })

    await getVerseOfTheDayPassageId(credentials)

    expect(getVOTD.mock.calls[0]).toEqual([expect.any(Number)])
    expect(getVOTD.mock.calls[0]).toHaveLength(1)
  })
})

describe('useVerseOfTheDayPassageId', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <YouVersionContext.Provider value={credentials}>{children}</YouVersionContext.Provider>
  )

  it('returns the passage_id once the lookup succeeds', async () => {
    getVOTD.mockResolvedValue({ day: 15, passage_id: 'JHN.3.16' })

    const { result } = renderHook(() => useVerseOfTheDayPassageId(), { wrapper })

    expect(result.current).toBeNull()
    await waitFor(() => {
      expect(result.current).toBe('JHN.3.16')
    })
  })

  it('stays null when the lookup fails', async () => {
    getVOTD.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useVerseOfTheDayPassageId(), { wrapper })

    expect(result.current).toBeNull()
    await waitFor(() => {
      expect(getVOTD).toHaveBeenCalled()
    })
    expect(result.current).toBeNull()
  })
})

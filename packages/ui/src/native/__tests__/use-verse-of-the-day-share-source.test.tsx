/**
 * Layer 3 — VOTD share source follows the current provider filter lists.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'

import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { useVerseOfTheDayShareSource } from '../use-verse-of-the-day-share-source'
import * as votdShare from '../verse-of-the-day-share'
import { YouVersionProvider } from '../youversion-provider'

const sampleShareData: VerseOfTheDayShareData = {
  text: 'For God so loved the world...\n\nJohn 3:16 NIV',
  reference: 'John 3:16 NIV',
  verseText: 'For God so loved the world...',
}

const getShare = jest.spyOn(votdShare, 'getVerseOfTheDayShareSource')

beforeEach(() => {
  getShare.mockReset()
  getShare.mockResolvedValue(sampleShareData)
})

afterAll(() => {
  getShare.mockRestore()
})

function filterWrapper(permittedLanguageTags?: string[]) {
  const holder = { current: permittedLanguageTags }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <YouVersionProvider
        appKey="test-key"
        theme="light"
        hookOverrides={defaultHookOverrides}
        permittedLanguageTags={holder.current}
      >
        {children}
      </YouVersionProvider>
    )
  }

  function setPermittedLanguageTags(next?: string[]) {
    holder.current = next
  }

  return Object.assign(Wrapper, { setPermittedLanguageTags })
}

describe('useVerseOfTheDayShareSource', () => {
  it('returns share data once the fetch succeeds', async () => {
    const { result } = renderHook(() => useVerseOfTheDayShareSource(3034, 'JHN.3.16'), {
      wrapper: filterWrapper(),
    })

    expect(result.current.shareSource).toBeNull()
    await waitFor(() => {
      expect(result.current.shareSource).toEqual(sampleShareData)
    })
  })

  it('does not restore share data from a request started under looser filters', async () => {
    let resolveLoose: (value: VerseOfTheDayShareData | null) => void
    getShare.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoose = resolve
        }),
    )
    getShare.mockResolvedValueOnce(null)

    const wrapper = filterWrapper()
    const { result, rerender } = renderHook(
      () => useVerseOfTheDayShareSource(3034, 'JHN.3.16'),
      { wrapper },
    )

    await waitFor(() => {
      expect(getShare).toHaveBeenCalledTimes(1)
    })

    wrapper.setPermittedLanguageTags(['en'])
    rerender(undefined)

    await waitFor(() => {
      expect(getShare).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(result.current.shareSource).toBeNull()
    })

    await act(async () => {
      resolveLoose(sampleShareData)
    })

    expect(result.current.shareSource).toBeNull()
    expect(getShare).toHaveBeenLastCalledWith(expect.any(Function), 3034, 'JHN.3.16', {
      permittedVersionIds: undefined,
      excludedVersionIds: undefined,
      permittedLanguageTags: ['en'],
    })
  })

  it('returns null from a share load that started under looser filters', async () => {
    let resolvePress: (value: VerseOfTheDayShareData | null) => void
    getShare.mockResolvedValueOnce(null)
    getShare.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePress = resolve
        }),
    )

    const wrapper = filterWrapper()
    const { result, rerender } = renderHook(
      () => useVerseOfTheDayShareSource(3034, 'JHN.3.16'),
      { wrapper },
    )

    await waitFor(() => {
      expect(getShare).toHaveBeenCalledTimes(1)
    })
    expect(result.current.shareSource).toBeNull()

    let inFlight!: Promise<VerseOfTheDayShareData | null>
    await act(async () => {
      inFlight = result.current.loadShareSource()
    })

    await waitFor(() => {
      expect(getShare).toHaveBeenCalledTimes(2)
    })

    wrapper.setPermittedLanguageTags(['en'])
    rerender(undefined)

    await act(async () => {
      resolvePress(sampleShareData)
    })

    expect(await inFlight).toBeNull()
  })

  it('returns the in-flight verse when Share is pressed before preload settles', async () => {
    let resolvePreload: (value: VerseOfTheDayShareData | null) => void
    getShare.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePreload = resolve
        }),
    )
    getShare.mockResolvedValueOnce(null)

    const { result } = renderHook(() => useVerseOfTheDayShareSource(3034, 'JHN.3.16'), {
      wrapper: filterWrapper(),
    })

    await waitFor(() => {
      expect(getShare).toHaveBeenCalledTimes(1)
    })

    let inFlight!: Promise<VerseOfTheDayShareData | null>
    await act(async () => {
      inFlight = result.current.loadShareSource()
    })

    await act(async () => {
      resolvePreload(sampleShareData)
    })

    expect(await inFlight).toEqual(sampleShareData)
    expect(result.current.shareSource).toEqual(sampleShareData)
  })
})

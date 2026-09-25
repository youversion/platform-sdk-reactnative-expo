import { fireEvent, render, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { useRecentBibleVersionsStore } from '../../stores/recent-bible-versions-store'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleVersionPickerSheet } from '../bible-version-picker-sheet'

const wrapper = youVersionProviderWrapper('light', 'en')

type VersionLookup = 'ready' | 'missing-tag' | 'reject' | 'reject-once'

function jsonResponse(body: string): Promise<Response> {
  return Promise.resolve(
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }),
  )
}

function installCatalogFetch(versionLookup: VersionLookup) {
  let versionLookupAttempts = 0
  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = String(input)
    const parsed = new URL(url)
    if (parsed.pathname === '/v1/languages') {
      const country = parsed.searchParams.get('country')
      const languages =
        country === 'zz'
          ? [{ id: 'en', display_names: { en: 'English' } }]
          : [
              { id: 'en', display_names: { en: 'English' } },
              { id: 'es', display_names: { en: 'Spanish' } },
            ]
      return jsonResponse(JSON.stringify({ data: languages }))
    }
    if (parsed.pathname === '/v1/bibles') {
      const ranges = parsed.searchParams.getAll('language_ranges[]')
      if (ranges.includes('es')) {
        return jsonResponse(
          JSON.stringify({
            data: [
              {
                id: 128,
                language_tag: 'es',
                localized_title: 'Reina Valera',
                localized_abbreviation: 'RVR',
              },
            ],
          }),
        )
      }
      if (ranges.includes('en')) {
        return jsonResponse(
          JSON.stringify({
            data: [
              {
                id: 3034,
                language_tag: 'en',
                localized_title: 'Berean Standard Bible',
                localized_abbreviation: 'BSB',
              },
              {
                id: 111,
                language_tag: 'en',
                localized_title: 'King James Version',
                localized_abbreviation: 'KJV',
              },
            ],
          }),
        )
      }
      return jsonResponse(
        JSON.stringify({
          data: [
            {
              id: 3034,
              language_tag: 'en',
              localized_title: 'Berean Standard Bible',
              localized_abbreviation: 'BSB',
            },
            {
              id: 111,
              language_tag: 'en',
              localized_title: 'King James Version',
              localized_abbreviation: 'KJV',
            },
            {
              id: 128,
              language_tag: 'es',
              localized_title: 'Reina Valera',
              localized_abbreviation: 'RVR',
            },
          ],
        }),
      )
    }
    if (/\/v1\/bibles\/\d+$/.test(parsed.pathname)) {
      versionLookupAttempts += 1
      if (
        versionLookup === 'reject' ||
        (versionLookup === 'reject-once' && versionLookupAttempts === 1)
      ) {
        return Promise.reject(new Error('version unavailable'))
      }
      if (versionLookup === 'missing-tag') {
        return jsonResponse(JSON.stringify({}))
      }
      return jsonResponse(JSON.stringify({ language_tag: 'en', abbreviation: 'BSB' }))
    }
    if (url.includes('/v1/fonts/')) {
      return jsonResponse(
        JSON.stringify({
          id: 1,
          slug: 'untitled-serif',
          family: 'Untitled Serif',
          variants: [],
        }),
      )
    }
    return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
  })
}

describe('BibleVersionPickerSheet selection', () => {
  beforeEach(() => {
    resetImpls()
    stubDeviceLocale('en-US', 'en')
    useRecentBibleVersionsStore.setState({ versionIds: [] })
    setImpl('NativeSheet', ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <View testID="sheet">{children}</View> : null,
    )
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('keeps the previous row and recents when onSelect rejects', async () => {
    installCatalogFetch('ready')
    const onSelect = jest.fn().mockRejectedValue(new Error('boom'))
    const onClose = jest.fn()

    const { findByLabelText, getByLabelText } = render(
      <BibleVersionPickerSheet
        isOpen={true}
        onClose={onClose}
        onSelect={onSelect}
        versionId={3034}
      />,
      { wrapper },
    )

    await findByLabelText('King James Version')
    fireEvent.press(getByLabelText('King James Version'))

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(111))
    expect(onClose).not.toHaveBeenCalled()
    expect(getByLabelText('Berean Standard Bible').props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    })
    expect(getByLabelText('King James Version').props.accessibilityState).toEqual({
      selected: false,
      disabled: false,
    })
    expect(useRecentBibleVersionsStore.getState().versionIds).toEqual([])
  })

  it('records the version and closes when onSelect resolves', async () => {
    installCatalogFetch('ready')
    const onSelect = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()

    const { findByLabelText, getByLabelText } = render(
      <BibleVersionPickerSheet
        isOpen={true}
        onClose={onClose}
        onSelect={onSelect}
        versionId={3034}
      />,
      { wrapper },
    )

    await findByLabelText('King James Version')
    fireEvent.press(getByLabelText('King James Version'))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith(111)
    expect(useRecentBibleVersionsStore.getState().versionIds).toEqual([111])
  })

  it('lets the user choose a replacement when the current version has no language', async () => {
    installCatalogFetch('missing-tag')
    const onSelect = jest.fn().mockResolvedValue(undefined)

    const { findByText, findByLabelText, getByText, queryByText } = render(
      <BibleVersionPickerSheet
        isOpen={true}
        onClose={() => {}}
        onSelect={onSelect}
        versionId={3034}
      />,
      { wrapper },
    )

    await findByText('Language')
    expect(queryByText('Error')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.press(getByText('Language'))
    fireEvent.press(await findByLabelText('Spanish'))
    fireEvent.press(await findByLabelText('Reina Valera'))

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith(128)
  })

  it('lets the user choose a replacement when the current version lookup fails', async () => {
    installCatalogFetch('reject')
    const onSelect = jest.fn().mockResolvedValue(undefined)

    const { findByText, findByLabelText, getByText, queryByText } = render(
      <BibleVersionPickerSheet
        isOpen={true}
        onClose={() => {}}
        onSelect={onSelect}
        versionId={3034}
      />,
      { wrapper },
    )

    await findByText('Retry')
    expect(queryByText('No versions found')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.press(getByText('Language'))
    fireEvent.press(await findByLabelText('Spanish'))
    fireEvent.press(await findByLabelText('Reina Valera'))

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith(128)
  })

  it('retries a failed current-version lookup without replacing the host version', async () => {
    installCatalogFetch('reject-once')
    const onSelect = jest.fn().mockResolvedValue(undefined)

    const { findByText, findByLabelText, queryByText } = render(
      <BibleVersionPickerSheet
        isOpen={true}
        onClose={() => {}}
        onSelect={onSelect}
        versionId={3034}
      />,
      { wrapper },
    )

    fireEvent.press(await findByText('Retry'))

    await findByLabelText('King James Version')
    expect(queryByText('Error')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })
})

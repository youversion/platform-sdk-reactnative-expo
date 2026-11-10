import { fireEvent, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { useRecentBibleVersionsStore } from '../../stores/recent-bible-versions-store'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleVersionPickerSheet } from '../bible-version-picker-sheet'
import { clearVersionPickerMemoryCache } from '../version-picker-catalog-cache'

const wrapper = youVersionProviderWrapper('light', 'en')

type RecordedRequest = {
  kind: 'catalog' | 'language-versions' | 'version-meta'
  url: string
}

function jsonResponse(body: string, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(body, {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }),
  )
}

function requestKind(url: string): RecordedRequest['kind'] | 'other' {
  const parsed = new URL(url)
  if (parsed.pathname === '/v1/languages') {
    return 'catalog'
  }
  if (parsed.pathname === '/v1/bibles') {
    const specificRange = parsed.searchParams
      .getAll('language_ranges[]')
      .some((range) => range !== '*')
    if (specificRange) {
      return 'language-versions'
    }
    return 'catalog'
  }
  if (/\/v1\/bibles\/\d+$/.test(parsed.pathname)) {
    return 'version-meta'
  }
  return 'other'
}

function installPickerFetch(options?: { failLanguages?: () => boolean }) {
  const requests: RecordedRequest[] = []
  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = String(input)
    const parsed = new URL(url)
    const kind = requestKind(url)
    if (kind !== 'other') {
      requests.push({ kind, url })
    }
    if (parsed.pathname === '/v1/languages') {
      if (options?.failLanguages?.()) {
        return jsonResponse(JSON.stringify({ message: 'slow down' }), 429)
      }
      const country = parsed.searchParams.get('country')
      const languages =
        country?.toLowerCase() === 'zz'
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
            { id: 3034, language_tag: 'en', localized_title: 'Berean Standard Bible' },
            { id: 111, language_tag: 'en', localized_title: 'King James Version' },
            { id: 128, language_tag: 'es', localized_title: 'Reina Valera' },
          ],
        }),
      )
    }
    if (/\/v1\/bibles\/\d+$/.test(parsed.pathname)) {
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
  return requests
}

function countKind(requests: readonly RecordedRequest[], kind: RecordedRequest['kind']): number {
  return requests.filter((request) => request.kind === kind).length
}

describe('Bible version picker catalog cache', () => {
  beforeEach(() => {
    resetImpls()
    clearVersionPickerMemoryCache()
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

  it('does not refetch the catalog when the language changes', async () => {
    const requests = installPickerFetch()
    const { findByLabelText, getByLabelText, getByText } = render(
      <BibleVersionPickerSheet isOpen onClose={() => {}} versionId={3034} />,
      { wrapper },
    )

    await findByLabelText('King James Version')
    const catalogAfterOpen = countKind(requests, 'catalog')
    const versionsAfterOpen = countKind(requests, 'language-versions')
    expect(catalogAfterOpen).toBeGreaterThan(0)

    fireEvent.press(getByLabelText('Language'))
    fireEvent.press(getByText('All (2)'))
    fireEvent.press(await findByLabelText('Spanish'))

    await findByLabelText('Reina Valera')
    expect(countKind(requests, 'catalog')).toBe(catalogAfterOpen)
    expect(countKind(requests, 'language-versions')).toBe(versionsAfterOpen + 1)
    const latestVersions = requests.filter((request) => request.kind === 'language-versions').at(-1)
    expect(latestVersions?.url).toContain('language_ranges')
    expect(latestVersions?.url).toContain('es')
  })

  it('reuses the catalog and the language versions after the picker is closed and opened', async () => {
    const requests = installPickerFetch()
    const { findByLabelText, rerender } = render(
      <BibleVersionPickerSheet isOpen onClose={() => {}} versionId={3034} />,
      { wrapper },
    )

    await findByLabelText('King James Version')
    const catalogAfterOpen = countKind(requests, 'catalog')
    const versionsAfterOpen = countKind(requests, 'language-versions')
    expect(catalogAfterOpen).toBeGreaterThan(0)
    expect(versionsAfterOpen).toBeGreaterThan(0)

    rerender(<BibleVersionPickerSheet isOpen={false} onClose={() => {}} versionId={3034} />)
    rerender(<BibleVersionPickerSheet isOpen onClose={() => {}} versionId={3034} />)

    await findByLabelText('King James Version')
    expect(countKind(requests, 'catalog')).toBe(catalogAfterOpen)
    expect(countKind(requests, 'language-versions')).toBe(versionsAfterOpen)
  })

  it('shows Retry after a rejected catalog load and recovers when Retry is pressed', async () => {
    let failLanguages = true
    const requests = installPickerFetch({ failLanguages: () => failLanguages })
    const { findByLabelText, findAllByText, queryAllByText } = render(
      <BibleVersionPickerSheet isOpen onClose={() => {}} versionId={3034} />,
      { wrapper },
    )

    const retryButtons = await findAllByText('Retry')
    expect(queryAllByText('No versions found')).toHaveLength(0)
    expect(queryAllByText('Error').length).toBeGreaterThan(0)
    const catalogBeforeRetry = countKind(requests, 'catalog')
    expect(catalogBeforeRetry).toBeGreaterThan(0)
    expect(countKind(requests, 'language-versions')).toBe(0)
    expect(countKind(requests, 'version-meta')).toBe(0)

    failLanguages = false
    const retryButton = retryButtons[0]
    if (retryButton === undefined) {
      throw new Error('expected a Retry button')
    }
    fireEvent.press(retryButton)

    await findByLabelText('King James Version')
    expect(queryAllByText('Retry')).toHaveLength(0)
    expect(countKind(requests, 'catalog')).toBeGreaterThan(catalogBeforeRetry)
    expect(countKind(requests, 'language-versions')).toBeGreaterThan(0)
  })
})

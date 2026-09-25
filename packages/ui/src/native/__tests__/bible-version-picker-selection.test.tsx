import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Children, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text as RNText, View } from 'react-native'

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

function installCatalogFetch(
  versionLookup: VersionLookup,
  abbreviations: Readonly<Record<number, string>> = {},
) {
  let versionLookupAttempts = 0
  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = String(input)
    const parsed = new URL(url)
    if (parsed.pathname === '/v1/languages') {
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
                localized_abbreviation: abbreviations[3034] ?? 'BSB',
              },
              {
                id: 111,
                language_tag: 'en',
                localized_title: 'King James Version',
                localized_abbreviation: abbreviations[111] ?? 'KJV',
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
              localized_abbreviation: abbreviations[3034] ?? 'BSB',
            },
            {
              id: 111,
              language_tag: 'en',
              localized_title: 'King James Version',
              localized_abbreviation: abbreviations[111] ?? 'KJV',
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
    fireEvent.press(getByText('All (2)'))
    fireEvent.press(await findByLabelText('Spanish'))
    fireEvent.press(await findByLabelText('Reina Valera'))

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith(128)
  })

  it('shows catalog counts and searches languages within the same sheet', async () => {
    installCatalogFetch('ready')

    const {
      findByText,
      getByLabelText,
      getByRole,
      getByText,
      findByLabelText,
      queryByLabelText,
      queryByPlaceholderText,
      queryByRole,
    } = render(<BibleVersionPickerSheet isOpen={true} onClose={() => {}} versionId={3034} />, {
      wrapper,
    })

    await findByText('3 All Versions · 2 All Languages')
    fireEvent.press(getByLabelText('Language'))
    expect(getByRole('tab', { name: 'Suggested' }).props.accessibilityState.selected).toBe(true)
    await waitFor(() => expect(queryByLabelText('Spanish')).toBeNull())
    fireEvent.press(getByRole('tab', { name: 'All (2)' }))
    expect(getByRole('tab', { name: 'All (2)' }).props.accessibilityState.selected).toBe(true)
    expect(getByLabelText('Spanish')).toBeTruthy()
    fireEvent.press(getByRole('tab', { name: 'Suggested' }))
    await waitFor(() => expect(queryByLabelText('Spanish')).toBeNull())
    fireEvent.press(getByLabelText('Search languages'))
    expect(queryByRole('tab', { name: 'Suggested' })).toBeNull()
    expect(getByLabelText('Search languages').props.autoFocus).toBe(true)
    fireEvent.changeText(getByLabelText('Search languages'), 'span')
    expect(getByLabelText('Spanish')).toBeTruthy()
    fireEvent.press(getByLabelText('Clear search'))
    expect(getByLabelText('Search languages').props.value).toBe('')
    fireEvent.changeText(getByLabelText('Search languages'), 'span')
    fireEvent.press(getByLabelText('Cancel'))
    expect(queryByPlaceholderText('Search languages')).toBeNull()
    expect(getByText('All (2)')).toBeTruthy()
    fireEvent.press(getByLabelText('Search languages'))
    expect(getByLabelText('Search languages').props.value).toBe('')
    fireEvent.changeText(getByLabelText('Search languages'), 'span')
    fireEvent.press(await findByLabelText('Spanish'))
    expect(await findByLabelText('Reina Valera')).toBeTruthy()
  })

  it('cross-fades panels while keeping the hidden panel inert', async () => {
    installCatalogFetch('ready')
    const { findByText, getByLabelText, UNSAFE_getAllByType } = render(
      <BibleVersionPickerSheet isOpen onClose={() => {}} versionId={3034} />,
      { wrapper },
    )

    await findByText('English Bible Versions')
    const panels = UNSAFE_getAllByType(View)
    const versions = panels.find((view) => view.props.testID === 'version-picker-versions-panel')!
    const languages = panels.find((view) => view.props.testID === 'version-picker-languages-panel')!
    expect(StyleSheet.flatten(versions.props.style).opacity).toBe(1)
    expect(StyleSheet.flatten(languages.props.style).opacity).toBe(0)
    expect(languages.props.pointerEvents).toBe('none')

    fireEvent.press(getByLabelText('Language'))
    expect(StyleSheet.flatten(versions.props.style).opacity).toBe(0)
    expect(versions.props.pointerEvents).toBe('none')
    expect(StyleSheet.flatten(languages.props.style).opacity).toBe(1)
    expect(languages.props.pointerEvents).toBe('auto')

    fireEvent.press(getByLabelText('Back to Bible versions'))
    expect(StyleSheet.flatten(versions.props.style).opacity).toBe(1)
    expect(languages.props.pointerEvents).toBe('none')
  })

  it('fits long abbreviations on one line except for trailing digits', async () => {
    installCatalogFetch('ready', { 3034: 'TOIB2011', 111: 'CEVDCI' })
    const { findByText, getByText, queryByText, UNSAFE_getAllByType } = render(
      <BibleVersionPickerSheet isOpen onClose={() => {}} versionId={3034} />,
      { wrapper },
    )

    await findByText('King James Version')
    const badgeTexts = () => UNSAFE_getAllByType(RNText)
    const prefix = badgeTexts().find(
      (node) => node.props.children === 'TOIB' && node.props.onTextLayout,
    )
    const letters = badgeTexts().find(
      (node) => node.props.children === 'CEVDCI' && node.props.onTextLayout,
    )
    expect(prefix).toBeDefined()
    expect(letters).toBeDefined()
    expect(queryByText('TOIB2011')).toBeNull()
    expect(getByText('2011')).toBeTruthy()

    fireEvent(prefix!, 'textLayout', { nativeEvent: { lines: [{ width: 52, height: 20 }] } })
    fireEvent(letters!, 'textLayout', { nativeEvent: { lines: [{ width: 65, height: 20 }] } })
    const prefixLine = getByText('TOIB')
    const digitsLine = getByText('2011')
    const lettersLine = getByText('CEVDCI')
    expect(StyleSheet.flatten(prefixLine?.props.style).fontSize).toBeCloseTo(14)
    expect(StyleSheet.flatten(digitsLine.props.style).fontSize).toBeCloseTo(14)
    expect(StyleSheet.flatten(lettersLine?.props.style).fontSize).toBeCloseTo(12)
    expect(lettersLine?.props.numberOfLines).toBeUndefined()
    expect(StyleSheet.flatten(lettersLine?.props.style).width).toBe('100%')
  })

  it('sticks whichever version section headings are visible', async () => {
    useRecentBibleVersionsStore.setState({ versionIds: [111] })
    installCatalogFetch('ready')

    const { findByText, getByLabelText, getByText, queryByText, UNSAFE_getAllByType } = render(
      <BibleVersionPickerSheet isOpen onClose={() => {}} versionId={3034} />,
      { wrapper },
    )

    await findByText('Recently Used Versions')
    expect(getByText('English Bible Versions')).toBeTruthy()
    const list = UNSAFE_getAllByType(ScrollView).find(
      (view) => view.props.stickyHeaderIndices !== undefined,
    )
    expect(list?.props.stickyHeaderIndices).toEqual([0, 2])
    expect(Children.toArray(list?.props.children)[0]).toHaveProperty(
      'props.children.props.children',
      'Recently Used Versions',
    )
    expect(Children.toArray(list?.props.children)[2]).toHaveProperty(
      'props.children.props.children',
      ['English', ' ', 'Bible Versions'],
    )

    fireEvent.changeText(getByLabelText('Search versions'), 'Berean')
    expect(queryByText('Recently Used Versions')).toBeNull()
    expect(getByText('English Bible Versions')).toBeTruthy()
    expect(list?.props.stickyHeaderIndices).toEqual([0])
    expect(Children.toArray(list?.props.children)[0]).toHaveProperty(
      'props.children.props.children',
      ['English', ' ', 'Bible Versions'],
    )

    fireEvent.changeText(getByLabelText('Search versions'), 'King James')
    expect(getByText('Recently Used Versions')).toBeTruthy()
    expect(queryByText('English Bible Versions')).toBeNull()
    expect(list?.props.stickyHeaderIndices).toEqual([0])

    fireEvent.changeText(getByLabelText('Search versions'), 'not a version')
    expect(list?.props.stickyHeaderIndices).toEqual([])
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
    fireEvent.press(getByText('All (2)'))
    fireEvent.press(await findByLabelText('Spanish'))
    fireEvent.press(await findByLabelText('Reina Valera'))

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith(128)
  })

  it('keeps recent versions selectable when the current version lookup fails', async () => {
    useRecentBibleVersionsStore.setState({ versionIds: [111] })
    installCatalogFetch('reject')
    const onSelect = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()

    const { findByText, findByLabelText, getByLabelText } = render(
      <BibleVersionPickerSheet
        isOpen={true}
        onClose={onClose}
        onSelect={onSelect}
        versionId={3034}
      />,
      { wrapper },
    )

    await findByText('Retry')
    fireEvent.press(await findByLabelText('King James Version'))

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(111))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(getByLabelText('King James Version').props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    })
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

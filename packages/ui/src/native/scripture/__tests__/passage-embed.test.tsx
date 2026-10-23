import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import type { FootnoteData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { StyleSheet, type TextStyle } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import en from '../../../i18n/locales/en.json'
import es from '../../../i18n/locales/es.json'
import {
  installBibleContentFetch,
  type BibleContentFetchStub,
} from '../../../test-utils/stub-bible-content-fetch'
import { youVersionProviderWrapper } from '../../../test-utils/youversion-provider-wrapper'
import { YouVersionProvider } from '../../youversion-provider'
import { PassageEmbed } from '../passage-embed'

const wrapper = youVersionProviderWrapper()

function fontSizeOf(node: ReactTestInstance): number | undefined {
  let current: ReactTestInstance | null = node
  while (current !== null) {
    const size = flattenedTextStyle(current).fontSize
    if (size !== undefined) {
      return size
    }
    current = current.parent
  }
  return undefined
}

function fontFamilyOf(node: ReactTestInstance): string | undefined {
  let current: ReactTestInstance | null = node
  while (current !== null) {
    const family = flattenedTextStyle(current).fontFamily
    if (family !== undefined) {
      return family
    }
    current = current.parent
  }
  return undefined
}

function flattenedTextStyle(node: ReactTestInstance): TextStyle {
  // SAFETY: StyleSheet.flatten returns the merged RN style object for this node.
  return (StyleSheet.flatten(node.props.style) ?? {}) as TextStyle
}

describe('PassageEmbed', () => {
  let fetchStub: BibleContentFetchStub

  beforeEach(() => {
    fetchStub = installBibleContentFetch()
  })

  afterEach(() => {
    fetchStub.restore()
  })

  it('draws the requested verse and its verse number from the chapter', async () => {
    const { getByText, queryByText } = render(
      <PassageEmbed
        reference="JHN.3.16"
        versionId={3034}
        highlights={[]}
        fontSize={16}
        font="serif"
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })
    expect(getByText('16')).toBeTruthy()
    expect(queryByText('In the beginning')).toBeNull()
    expect(fetchStub.urls.some((url) => url.includes('/v1/bibles/3034/passages/JHN.3?'))).toBe(true)
    expect(fetchStub.urls.some((url) => url.includes('JHN.3.16'))).toBe(false)
    expect(fontSizeOf(getByText('For God so loved'))).toBe(16)
  })

  it('uses the sans face at the host size', async () => {
    const { getByText } = render(
      <PassageEmbed
        reference="JHN.3.16"
        versionId={3034}
        highlights={[]}
        fontSize={20}
        font="sans"
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })
    expect(fontSizeOf(getByText('For God so loved'))).toBe(20)
    expect(fontFamilyOf(getByText('For God so loved'))).toBe('Inter')
  })

  it('shows unavailable with no retry when the chapter is missing', async () => {
    fetchStub.passageStatus = 404
    const { getByText, queryByTestId } = render(
      <PassageEmbed
        reference="JHN.3.16"
        versionId={3034}
        highlights={[]}
        fontSize={16}
        font="serif"
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(getByText(en.passageUnavailable)).toBeTruthy()
    })
    expect(queryByTestId('scripture-retry')).toBeNull()
  })

  it('retries a failed chapter and then draws the verse', async () => {
    fetchStub.passageStatus = 503
    const { getByText, getByTestId, queryByText } = render(
      <PassageEmbed
        reference="JHN.3.16"
        versionId={3034}
        highlights={[]}
        fontSize={16}
        font="serif"
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(getByText(en['generic.requestErrorBody'])).toBeTruthy()
    })

    fetchStub.passageStatus = 200
    await act(async () => {
      fireEvent.press(getByTestId('scripture-retry'))
    })

    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })
    expect(queryByText(en['generic.requestErrorBody'])).toBeNull()
  })

  it('retries an offline chapter', async () => {
    fetchStub.failPassage = true
    const { getByText, getByTestId } = render(
      <PassageEmbed
        reference="JHN.3.16"
        versionId={3034}
        highlights={[]}
        fontSize={16}
        font="serif"
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(getByText(en.offlineConnectionLostMessage)).toBeTruthy()
    })
    expect(getByTestId('scripture-retry')).toBeTruthy()
  })

  it('does not request a version the provider excludes', async () => {
    function Refused({ children }: { children: ReactNode }) {
      return (
        <YouVersionProvider appKey="test-key" theme="light" excludedVersionIds={[3034]}>
          {children}
        </YouVersionProvider>
      )
    }

    const { getByText } = render(
      <PassageEmbed
        reference="JHN.3.16"
        versionId={3034}
        highlights={[]}
        fontSize={16}
        font="serif"
      />,
      { wrapper: Refused },
    )

    await waitFor(() => {
      expect(getByText(en.passageUnavailable)).toBeTruthy()
    })
    expect(fetchStub.urls.some((url) => url.includes('/passages/'))).toBe(false)
  })

  it('uses the provider locale for a failed chapter', async () => {
    fetchStub.passageStatus = 503
    const { getByText } = render(
      <PassageEmbed
        reference="JHN.3.16"
        versionId={3034}
        highlights={[]}
        fontSize={16}
        font="serif"
      />,
      { wrapper: youVersionProviderWrapper('light', 'es') },
    )

    await waitFor(() => {
      expect(getByText(es['generic.requestErrorBody'])).toBeTruthy()
    })
  })

  it('opens a footnote from the verse', async () => {
    const onFootnotePress = jest.fn<(data: FootnoteData) => void>()
    const { getByLabelText } = render(
      <PassageEmbed
        reference="JHN.1.1"
        versionId={3034}
        highlights={[]}
        fontSize={16}
        font="serif"
        onFootnotePress={onFootnotePress}
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(getByLabelText(en.footnoteAriaLabel)).toBeTruthy()
    })
    fireEvent.press(getByLabelText(en.footnoteAriaLabel))
    expect(onFootnotePress).toHaveBeenCalledWith(
      expect.objectContaining({ verseNum: '1', notes: expect.any(Array) }),
    )
    expect(onFootnotePress.mock.calls[0]?.[0].notes.length).toBeGreaterThan(0)
  })
})

import { act, fireEvent, render } from '@testing-library/react-native'
import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { BibleChapterPickerSheet } from '../bible-chapter-picker-sheet'
import { YouVersionProvider } from '../youversion-provider'

type LatestDomProps = {
  theme?: string
  resetKey?: number
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
  onSelect?: (data: BibleChapterPickerSelectData) => Promise<void>
}

let latestDomProps: LatestDomProps = {}

function MockDOM(props: LatestDomProps) {
  latestDomProps = props
  return (
    <View testID="mock-dom">
      <Text testID="theme-value">{props.theme ?? 'none'}</Text>
      <Pressable
        testID="trigger-select"
        onPress={() => {
          if (props.onSelect) {
            props.onSelect({ book: 'GEN', chapter: '3', versionId: 3034 })
          }
        }}
      >
        <Text>Select</Text>
      </Pressable>
    </View>
  )
}

const wrapper = youVersionProviderWrapper()

function versionFilterWrapper(lists: {
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
}) {
  return function FilterWrapper({ children }: { children: ReactNode }) {
    return (
      <YouVersionProvider
        appKey="test-key"
        theme="light"
        hookOverrides={defaultHookOverrides}
        {...lists}
      >
        {children}
      </YouVersionProvider>
    )
  }
}

const SAMPLE_SELECTION: BibleChapterPickerSelectData = {
  book: 'GEN',
  chapter: '3',
  versionId: 3034,
}

describe('BibleChapterPickerSheet', () => {
  beforeEach(() => {
    latestDomProps = {}
    setImpl('ChapterPickerContent', MockDOM)
    setImpl(
      'NativeSheet',
      ({
        isOpen,
        onClose,
        children,
      }: {
        isOpen: boolean
        onClose: () => void
        children: ReactNode
      }) =>
        isOpen ? (
          <View testID="sheet">
            <Pressable testID="trigger-close" onPress={onClose}>
              <Text>Close</Text>
            </Pressable>
            {children}
          </View>
        ) : null,
    )
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('fires onSelect with picker selection data and closes the sheet', async () => {
    const onSelect = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()

    const { getByTestId, queryByTestId, rerender } = render(
      <BibleChapterPickerSheet isOpen={true} onClose={onClose} onSelect={onSelect} />,
      { wrapper },
    )

    expect(getByTestId('sheet')).toBeTruthy()

    await act(async () => {
      // userEvent.press not yet stable in @testing-library/react-native
      fireEvent.press(getByTestId('trigger-select'))
    })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(SAMPLE_SELECTION)
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<BibleChapterPickerSheet isOpen={false} onClose={onClose} onSelect={onSelect} />)

    expect(queryByTestId('sheet')).toBeNull()
  })

  it('keeps the sheet open when onSelect rejects', async () => {
    const onSelect = jest.fn().mockRejectedValue(new Error('boom'))
    const onClose = jest.fn()

    const { getByTestId } = render(
      <BibleChapterPickerSheet isOpen={true} onClose={onClose} onSelect={onSelect} />,
      { wrapper },
    )

    await act(async () => {
      // userEvent.press not yet stable in @testing-library/react-native
      fireEvent.press(getByTestId('trigger-select'))
    })

    expect(onSelect).toHaveBeenCalledWith(SAMPLE_SELECTION)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('resolves theme from provider when no theme prop', () => {
    render(<BibleChapterPickerSheet isOpen={true} onClose={() => {}} />, { wrapper })

    expect(latestDomProps.theme).toBe('light')
  })

  it('explicit theme overrides provider theme', () => {
    render(<BibleChapterPickerSheet isOpen={true} onClose={() => {}} theme="dark" />, {
      wrapper: ({ children }) => (
        <YouVersionProvider appKey="test-key" theme="light" hookOverrides={defaultHookOverrides}>
          {children}
        </YouVersionProvider>
      ),
    })

    expect(latestDomProps.theme).toBe('dark')
  })

  it('system theme defers to provider resolved theme', () => {
    render(<BibleChapterPickerSheet isOpen={true} onClose={() => {}} theme="system" />, { wrapper })

    expect(latestDomProps.theme).toBe('light')
  })

  it('passes resetKey to DOM content', () => {
    render(<BibleChapterPickerSheet isOpen={true} onClose={() => {}} />, { wrapper })

    expect(latestDomProps.resetKey).toEqual(expect.any(Number))
  })

  it('increments resetKey when the sheet closes', () => {
    const { getByTestId, rerender } = render(
      <BibleChapterPickerSheet isOpen={true} onClose={() => {}} />,
      { wrapper },
    )

    const firstKey = latestDomProps.resetKey

    // Tapping out routes through NativeSheet's onClose, which bumps resetKey so the
    // picker tree remounts (clearing the book search filter) before the next open.
    fireEvent.press(getByTestId('trigger-close'))
    rerender(<BibleChapterPickerSheet isOpen={true} onClose={() => {}} />)

    expect(latestDomProps.resetKey).toBeGreaterThan(firstKey!)
  })

  it('forwards version filter lists from YouVersionProvider to DOM content', () => {
    render(<BibleChapterPickerSheet isOpen={true} onClose={() => {}} />, {
      wrapper: versionFilterWrapper({
        permittedVersionIds: [111],
        excludedVersionIds: [3034],
        permittedLanguageTags: ['en'],
      }),
    })

    expect(latestDomProps.permittedVersionIds).toEqual([111])
    expect(latestDomProps.excludedVersionIds).toEqual([3034])
    expect(latestDomProps.permittedLanguageTags).toEqual(['en'])
  })

  it('forwards empty version filter arrays to DOM content without coercing to undefined', () => {
    render(<BibleChapterPickerSheet isOpen={true} onClose={() => {}} />, {
      wrapper: versionFilterWrapper({
        permittedVersionIds: [],
        excludedVersionIds: [],
        permittedLanguageTags: [],
      }),
    })

    expect(latestDomProps.permittedVersionIds).toEqual([])
    expect(latestDomProps.excludedVersionIds).toEqual([])
    expect(latestDomProps.permittedLanguageTags).toEqual([])
  })
})

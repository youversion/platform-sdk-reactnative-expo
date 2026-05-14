import { act, fireEvent, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { BibleChapterPickerSheet } from '../bible-chapter-picker-sheet'
import { YouVersionProvider } from '../youversion-provider'
import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'

let latestDomProps: {
  theme?: string
  onSelect?: (data: BibleChapterPickerSelectData) => Promise<void>
} = {}

jest.mock('../../dom/chapter-picker-content', () => {
  // require() is intentional: ESM imports cannot be used inside jest.mock() factories
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      theme?: string
      onSelect?: (data: BibleChapterPickerSelectData) => Promise<void>
    }) {
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
    },
  }
})

jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // require() is intentional: ESM imports cannot be used inside jest.mock() factories
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <View testID="sheet">{children}</View> : null,
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

const SAMPLE_SELECTION: BibleChapterPickerSelectData = {
  book: 'GEN',
  chapter: '3',
  versionId: 3034,
}

describe('BibleChapterPickerSheet', () => {
  beforeEach(() => {
    latestDomProps = {}
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
        <YouVersionProvider appKey="test-key" theme="light">
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
})

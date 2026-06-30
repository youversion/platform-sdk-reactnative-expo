import { act, fireEvent, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { BibleVersionPickerSheet } from '../bible-version-picker-sheet'
import { YouVersionProvider } from '../youversion-provider'

type MockDomProps = {
  appKey?: string
  theme?: string
  versionId?: number
  resetKey?: number
  onVersionChange?: (versionId: number) => Promise<void>
}

let latestDomProps: MockDomProps = {}

jest.mock('../../dom/bible-version-picker-content', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: MockDomProps) {
      latestDomProps = props
      return (
        <View testID="mock-dom">
          <Text testID="theme-value">{props.theme ?? 'none'}</Text>
          <Text testID="version-value">{String(props.versionId ?? 'none')}</Text>
          <Pressable
            testID="trigger-select"
            onPress={() => {
              void props.onVersionChange?.(59)
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

describe('BibleVersionPickerSheet', () => {
  beforeEach(() => {
    latestDomProps = {}
  })

  it('fires onSelect with versionId and closes the sheet', async () => {
    const onSelect = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()

    const { getByTestId, queryByTestId, rerender } = render(
      <BibleVersionPickerSheet
        isOpen={true}
        onClose={onClose}
        onSelect={onSelect}
        versionId={3034}
      />,
      { wrapper },
    )

    expect(getByTestId('sheet')).toBeTruthy()
    expect(latestDomProps.versionId).toBe(3034)

    await act(async () => {
      fireEvent.press(getByTestId('trigger-select'))
    })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(59)
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <BibleVersionPickerSheet
        isOpen={false}
        onClose={onClose}
        onSelect={onSelect}
        versionId={3034}
      />,
    )

    expect(queryByTestId('sheet')).toBeNull()
  })

  it('keeps the sheet open when onSelect rejects', async () => {
    const onSelect = jest.fn().mockRejectedValue(new Error('boom'))
    const onClose = jest.fn()

    const { getByTestId } = render(
      <BibleVersionPickerSheet
        isOpen={true}
        onClose={onClose}
        onSelect={onSelect}
        versionId={3034}
      />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-select'))
    })

    expect(onSelect).toHaveBeenCalledWith(59)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('resolves theme from provider when no theme prop', () => {
    render(<BibleVersionPickerSheet isOpen={true} onClose={() => {}} />, { wrapper })

    expect(latestDomProps.theme).toBe('light')
  })

  it('explicit theme overrides provider theme', () => {
    render(<BibleVersionPickerSheet isOpen={true} onClose={() => {}} theme="dark" />, {
      wrapper: ({ children }) => (
        <YouVersionProvider appKey="test-key" theme="light">
          {children}
        </YouVersionProvider>
      ),
    })

    expect(latestDomProps.theme).toBe('dark')
  })

  it('system theme defers to provider resolved theme', () => {
    render(<BibleVersionPickerSheet isOpen={true} onClose={() => {}} theme="system" />, { wrapper })

    expect(latestDomProps.theme).toBe('light')
  })

  it('uses default versionId when not provided', () => {
    render(<BibleVersionPickerSheet isOpen={true} onClose={() => {}} />, { wrapper })

    expect(latestDomProps.versionId).toBe(3034)
  })

  it('passes appKey to DOM content', () => {
    render(<BibleVersionPickerSheet isOpen={true} onClose={() => {}} />, { wrapper })

    expect(latestDomProps.appKey).toBe('test-key')
  })

  it('passes resetKey to DOM content', () => {
    render(<BibleVersionPickerSheet isOpen={true} onClose={() => {}} />, { wrapper })

    expect(latestDomProps.resetKey).toEqual(expect.any(Number))
  })

  it('does not pass language panel state across the native bridge', () => {
    render(<BibleVersionPickerSheet isOpen={true} onClose={() => {}} />, { wrapper })

    expect(latestDomProps).not.toHaveProperty('showLanguagePicker')
    expect(latestDomProps).not.toHaveProperty('handleShowLanguagePicker')
  })
})

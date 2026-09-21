import { act, fireEvent, render } from '@testing-library/react-native'
import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { SHEET_SURFACE } from '../../lib/native-sheet-theme'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import type { BibleChapterPickerProps } from '../bible-chapter-picker'
import { BibleChapterPickerSheet } from '../bible-chapter-picker-sheet'

const SAMPLE_SELECTION: BibleChapterPickerSelectData = {
  book: 'GEN',
  chapter: '3',
  versionId: 3034,
}

type MockPickerProps = Pick<BibleChapterPickerProps, 'book' | 'chapter' | 'versionId' | 'onSelect'>

let latestPickerProps: MockPickerProps = {}
let latestBottomInsetColor: string | undefined
let pickerMounts = 0

function MockPicker(props: MockPickerProps) {
  latestPickerProps = props
  pickerMounts += 1
  return (
    <Pressable
      testID="trigger-select"
      onPress={() => {
        void Promise.resolve(props.onSelect?.(SAMPLE_SELECTION)).catch(() => {})
      }}
    >
      <Text>Select</Text>
    </Pressable>
  )
}

const wrapper = youVersionProviderWrapper()

describe('BibleChapterPickerSheet', () => {
  beforeEach(() => {
    latestPickerProps = {}
    latestBottomInsetColor = undefined
    pickerMounts = 0
    setImpl('BibleChapterPicker', MockPicker)
    setImpl(
      'NativeSheet',
      ({
        isOpen,
        onClose,
        bottomInsetColor,
        children,
      }: {
        isOpen: boolean
        onClose: () => void
        bottomInsetColor?: string
        children: ReactNode
      }) => {
        latestBottomInsetColor = bottomInsetColor
        return isOpen ? (
          <View testID="sheet">
            <Pressable testID="trigger-close" onPress={onClose}>
              <Text>Close</Text>
            </Pressable>
            {children}
          </View>
        ) : null
      },
    )
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('passes selection to the consumer and closes after it resolves', async () => {
    const onSelect = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()
    const { getByTestId } = render(
      <BibleChapterPickerSheet isOpen onClose={onClose} onSelect={onSelect} />,
      { wrapper },
    )

    await act(async () => fireEvent.press(getByTestId('trigger-select')))

    expect(onSelect).toHaveBeenCalledWith(SAMPLE_SELECTION)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the sheet open when selection rejects', async () => {
    const onSelect = jest.fn().mockRejectedValue(new Error('boom'))
    const onClose = jest.fn()
    const { getByTestId } = render(
      <BibleChapterPickerSheet isOpen onClose={onClose} onSelect={onSelect} />,
      { wrapper },
    )

    await act(async () => fireEvent.press(getByTestId('trigger-select')))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('forwards location and remounts the picker on each open', () => {
    const { rerender } = render(
      <BibleChapterPickerSheet isOpen onClose={() => {}} book="HEB" chapter="11" versionId={111} />,
      { wrapper },
    )
    expect(latestPickerProps).toMatchObject({ book: 'HEB', chapter: '11', versionId: 111 })
    const openMounts = pickerMounts

    rerender(<BibleChapterPickerSheet isOpen={false} onClose={() => {}} />)
    rerender(<BibleChapterPickerSheet isOpen onClose={() => {}} />)

    expect(pickerMounts).toBeGreaterThan(openMounts)
  })

  it('matches the bottom safe area to the sheet surface', () => {
    const { rerender } = render(<BibleChapterPickerSheet isOpen onClose={() => {}} />, { wrapper })
    expect(latestBottomInsetColor).toBe(SHEET_SURFACE.light)

    rerender(<BibleChapterPickerSheet isOpen onClose={() => {}} theme="dark" />)
    expect(latestBottomInsetColor).toBe(SHEET_SURFACE.dark)
  })
})

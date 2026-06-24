import { fireEvent, render, screen, within } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Platform, StyleSheet } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { youVersionProviderWrapper as wrapper } from '../../../test-utils/youversion-provider-wrapper'
import { ScriptureTextView } from '../scripture-text-view'

/** True when the node or an ancestor carries a `translateY` transform (a raised superscript). */
function hasRaisedAncestor(node: ReactTestInstance | null): boolean {
  for (let cur = node; cur; cur = cur.parent) {
    const transform = StyleSheet.flatten(cur.props.style)?.transform
    if (Array.isArray(transform) && transform.some((t) => 'translateY' in t)) return true
  }
  return false
}

// Transformed-footnote shape: verse 2 carries a `[data-verse-footnote]` anchor
// whose content the renderer surfaces as the marker's note text.
const FOOTNOTE_HTML =
  '<div class="p"><span class="yv-v" v="2"><span class="yv-vlbl">2 </span>Now the earth was formless<span data-verse-footnote="2" data-verse-footnote-content="&lt;span class=&quot;ft&quot;&gt;Or a wasteland&lt;/span&gt;"></span> and void.</span></div>'

// The footnote marker pulls in react-native-svg; stub it to a plain view that
// forwards onPress + the accessibility label so press/label queries still work.
jest.mock('../scripture-footnote-icon', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { FootnoteMarkerIcon: (props: object) => <View testID="footnote-icon" {...props} /> }
})

// Render NativeSheet's children only while open, so assertions can read the
// drawer body (the real sheet portals to a host the test tree doesn't mount).
jest.mock('../../native-sheet', () => {
  const actual = jest.requireActual('../../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({
      isOpen,
      onClose,
      children,
    }: {
      isOpen: boolean
      onClose: () => void
      children: ReactNode
    }) =>
      isOpen ? (
        <View testID="footnote-sheet">
          <Pressable testID="footnote-sheet-close" onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
          {children}
        </View>
      ) : null,
  }
})

describe('ScriptureTextView — native footnote drawer', () => {
  const originalOs = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('opens the drawer showing the verse reference, verse text, and note when no consumer handler is provided', () => {
    render(<ScriptureTextView versionId={1} usfm="GEN.1" html={FOOTNOTE_HTML} />, {
      wrapper: wrapper(),
    })

    expect(screen.queryByTestId('footnote-sheet')).toBeNull()

    fireEvent.press(screen.getByLabelText('Footnote'))

    // Scope to the drawer: the verse text also appears in the rendered passage.
    const sheet = within(screen.getByTestId('footnote-sheet'))
    // Reference (offline html path → usfm fallback `GEN.1.2`), verse text, the
    // in-verse note letter, and the lettered note below it.
    expect(sheet.getByText('GEN.1.2')).toBeTruthy()
    expect(sheet.getByText(/Now the earth was formless/)).toBeTruthy()
    expect(sheet.getByText(/Or a wasteland/)).toBeTruthy()
    // The note marker letter appears both in the verse (raised superscript) and
    // the note list below.
    const verseLetters = sheet.getAllByText('a')
    expect(verseLetters.length).toBeGreaterThan(0)
    expect(verseLetters.some((node) => hasRaisedAncestor(node))).toBe(true)
    expect(sheet.getByText('a.')).toBeTruthy()
  })

  it('closes the drawer when the sheet calls onClose', () => {
    render(<ScriptureTextView versionId={1} usfm="GEN.1" html={FOOTNOTE_HTML} />, {
      wrapper: wrapper(),
    })

    fireEvent.press(screen.getByLabelText('Footnote'))
    expect(screen.getByTestId('footnote-sheet')).toBeTruthy()

    fireEvent.press(screen.getByTestId('footnote-sheet-close'))
    expect(screen.queryByTestId('footnote-sheet')).toBeNull()
  })

  it('does not wire the built-in drawer on web', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    render(<ScriptureTextView versionId={1} usfm="GEN.1" html={FOOTNOTE_HTML} />, {
      wrapper: wrapper(),
    })

    fireEvent.press(screen.getByLabelText('Footnote'))
    expect(screen.queryByTestId('footnote-sheet')).toBeNull()
  })
})

import { renderHook } from '@testing-library/react-native'

import { INTER_FONT, UNTITLED_SERIF_FONT } from '../../../lib/reader-fonts'
import { youVersionProviderWrapper } from '../../../test-utils/youversion-provider-wrapper'
import { usePassageStyle } from '../passage-style'

const wrapper = youVersionProviderWrapper()

describe('usePassageStyle host fontFamily', () => {
  it('styles host italics with fontStyle, not a suffixed family name', () => {
    const { result } = renderHook(
      () =>
        usePassageStyle({
          passage: null,
          highlights: [],
          fontSize: 16,
          lineMultiple: 1.5,
          fontFamily: 'Georgia',
        }),
      { wrapper },
    )

    expect(result.current.look.face(400, true)).toEqual({
      fontFamily: 'Georgia',
      fontWeight: 400,
      fontStyle: 'italic',
    })
  })

  it('keeps a single host face name', () => {
    const { result } = renderHook(
      () =>
        usePassageStyle({
          passage: null,
          highlights: [],
          fontSize: 16,
          lineMultiple: 1.5,
          fontFamily: 'Avenir',
        }),
      { wrapper },
    )

    expect(result.current.look.face(400, false).fontFamily).toBe('Avenir')
  })

  it.each([
    ['sans-serif', 'Inter'],
    ['system-ui', 'Inter'],
    [' Sans-Serif ', 'Inter'],
    ['serif', 'Untitled Serif'],
    ['monospace', 'Untitled Serif'],
    ['var(--yv-reader-font-family)', 'Untitled Serif'],
  ])('maps the CSS value %j to %s instead of passing it to RN', (fontFamily, face) => {
    const { result } = renderHook(
      () =>
        usePassageStyle({
          passage: null,
          highlights: [],
          fontSize: 16,
          lineMultiple: 1.5,
          fontFamily,
        }),
      { wrapper },
    )

    expect(result.current.look.face(400, false).fontFamily).toBe(face)
  })

  it.each([
    ['"Georgia", serif', 'Untitled Serif'],
    ['"Helvetica Neue", Arial, sans-serif', 'Inter'],
  ])('maps the CSS stack %j to %s by its last keyword', (fontFamily, face) => {
    const { result } = renderHook(
      () =>
        usePassageStyle({
          passage: null,
          highlights: [],
          fontSize: 16,
          lineMultiple: 1.5,
          fontFamily,
        }),
      { wrapper },
    )

    expect(result.current.look.face(400, false).fontFamily).toBe(face)
  })

  it('still maps the Inter stack to Inter', () => {
    const { result } = renderHook(
      () =>
        usePassageStyle({
          passage: null,
          highlights: [],
          fontSize: 16,
          lineMultiple: 1.5,
          fontFamily: INTER_FONT,
        }),
      { wrapper },
    )

    expect(result.current.look.face(400, false).fontFamily).toBe('Inter')
  })

  it('still maps the Untitled Serif token to Untitled Serif', () => {
    const { result } = renderHook(
      () =>
        usePassageStyle({
          passage: null,
          highlights: [],
          fontSize: 16,
          lineMultiple: 1.5,
          fontFamily: UNTITLED_SERIF_FONT,
        }),
      { wrapper },
    )

    expect(result.current.look.face(400, false).fontFamily).toBe('Untitled Serif')
  })
})

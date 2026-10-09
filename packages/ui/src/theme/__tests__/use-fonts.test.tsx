import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { SERIF_STANDIN } from '../fonts'
import { SerifFamilyProvider, useSerifFace } from '../use-fonts'

function serifFaceFor(ready: boolean) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SerifFamilyProvider family="Untitled Serif" ready={ready}>
      {children}
    </SerifFamilyProvider>
  )
  return renderHook(() => useSerifFace(), { wrapper }).result.current
}

describe('useSerifFace', () => {
  it('names the mapped serif face once the serif is ready', () => {
    const faceFor = serifFaceFor(true)

    expect(faceFor(700, 'italic')).toEqual({ fontFamily: 'Untitled Serif_bold_italic' })
    expect(faceFor(400)).toEqual({ fontFamily: 'Untitled Serif' })
  })

  it('keeps weight and slant on the stand-in until the serif is ready', () => {
    const faceFor = serifFaceFor(false)

    expect(faceFor(700, 'italic')).toEqual({
      fontFamily: SERIF_STANDIN,
      fontWeight: '700',
      fontStyle: 'italic',
    })
    expect(faceFor(400)).toEqual({
      fontFamily: SERIF_STANDIN,
      fontWeight: '400',
      fontStyle: 'normal',
    })
  })
})

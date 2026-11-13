import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { FootnoteData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Pressable, Text } from 'react-native'

import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { stubFetch } from '../../test-utils/stub-fetch'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'
import type { TextDirection, VersionDirections } from '../scripture/use-version-directions'

const VERSION_ID = 187
const LTR_VERSION_ID = 1887
const NOTE: FootnoteData = { verseNum: '1', reference: 'John 1', verseHtml: '', notes: ['A note'] }

type BodyCapture = {
  versionDirections?: VersionDirections
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

let body: BodyCapture = {}
let sheetDirection: TextDirection | undefined

function MockBody(props: BodyCapture) {
  body = props
  return (
    <Pressable testID="open-note" onPress={() => void props.onFootnotePress?.(NOTE)}>
      <Text>Open</Text>
    </Pressable>
  )
}

function MockFootnote(props: { scriptureDirection?: TextDirection }) {
  sheetDirection = props.scriptureDirection
  return null
}

function stubIndex(directions: Record<number, TextDirection>): () => void {
  return stubFetch((url) => {
    const match = Object.entries(directions).find(([id]) => url.includes(`/${id}/index`))
    if (match === undefined) {
      return undefined
    }
    return new Response(JSON.stringify({ text_direction: match[1] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
}

describe('BibleReader text direction', () => {
  beforeEach(() => {
    body = {}
    sheetDirection = undefined
    installBibleReaderTestImpls()
    setImpl('BibleReaderNative', MockBody)
    setImpl('FootnoteContent', MockFootnote)
    setImpl('NativeSheet', ({ children }: { children: ReactNode }) => children)
  })

  afterEach(() => {
    resetImpls()
  })

  it('gives the reader and the footnote sheet the same index direction', async () => {
    const restore = stubIndex({ [VERSION_ID]: 'rtl' })
    try {
      render(<BibleReader versionId={VERSION_ID} book="JHN" chapter="1" />, {
        wrapper: youVersionProviderWrapper(),
      })
      await waitFor(() => expect(body.versionDirections?.get(VERSION_ID)).toBe('rtl'))

      fireEvent.press(screen.getByTestId('open-note'))
      await waitFor(() => expect(sheetDirection).toBe('rtl'))
    } finally {
      restore()
    }
  })

  it('keeps an open note in its own version direction when the version changes', async () => {
    const restore = stubIndex({ [VERSION_ID]: 'rtl', [LTR_VERSION_ID]: 'ltr' })
    try {
      const view = render(<BibleReader versionId={VERSION_ID} book="JHN" chapter="1" />, {
        wrapper: youVersionProviderWrapper(),
      })
      await waitFor(() => expect(body.versionDirections?.get(VERSION_ID)).toBe('rtl'))
      fireEvent.press(screen.getByTestId('open-note'))
      await waitFor(() => expect(sheetDirection).toBe('rtl'))

      view.rerender(<BibleReader versionId={LTR_VERSION_ID} book="JHN" chapter="1" />)
      await waitFor(() => expect(body.versionDirections?.get(LTR_VERSION_ID)).toBe('ltr'))
      expect(sheetDirection).toBe('rtl')
    } finally {
      restore()
    }
  })
})

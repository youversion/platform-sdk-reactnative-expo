import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { FootnoteData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Pressable, Text } from 'react-native'

import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'
import type { VersionDirections } from '../scripture/use-passage'

const VERSION_ID = 187
const NOTE: FootnoteData = { verseNum: '1', reference: 'John 1', verseHtml: '', notes: ['A note'] }

type BodyCapture = {
  versionDirections?: VersionDirections
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

let body: BodyCapture = {}
let sheetDirection: string | undefined

function MockBody(props: BodyCapture) {
  body = props
  return (
    <Pressable testID="open-note" onPress={() => void props.onFootnotePress?.(NOTE)}>
      <Text>Open</Text>
    </Pressable>
  )
}

function MockFootnote(props: { scriptureDirection?: string }) {
  sheetDirection = props.scriptureDirection
  return null
}

function stubIndex(direction: 'ltr' | 'rtl'): () => void {
  const prior = global.fetch
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
    String(input instanceof Request ? input.url : input).includes(`/${VERSION_ID}/index`)
      ? Promise.resolve(
          new Response(JSON.stringify({ text_direction: direction }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      : prior(input, init),
  )
  return () => {
    global.fetch = prior
  }
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
    const restore = stubIndex('rtl')
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
})

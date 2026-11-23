import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { bookTitlesFromBody, formatPassageLabel } from '../src/lib/passage-label.ts'
import {
  acceptIfCurrent,
  appendUniqueIds,
  dedupeAppend,
  emptyCardList,
  imagesInServerOrder,
  reduceLibrary,
  renditionUrl,
  unresolvedIds,
} from '../src/lib/image-library.ts'

const image = (id: string) => ({ id })

describe('image library pages', () => {
  it('appends unseen cards and leaves earlier cards in place', () => {
    const first = reduceLibrary(emptyCardList(), {
      type: 'replace',
      page: [image('a'), image('b')],
      nextPageToken: 'next',
    })
    const second = reduceLibrary(first, {
      type: 'append',
      page: [image('b'), image('c'), image('a')],
      nextPageToken: null,
    })

    assert.deepEqual(
      second.items.map((item) => item.id),
      ['a', 'b', 'c'],
    )
    assert.equal(second.nextPageToken, null)
  })

  it('keeps the selected card when a shorter replacement still contains it', () => {
    const current = {
      items: [image('a'), image('b'), image('c')],
      nextPageToken: 'next',
      selectedId: 'b',
    }
    const next = reduceLibrary(current, {
      type: 'replace',
      page: [image('c'), image('b')],
      nextPageToken: null,
    })

    assert.deepEqual(
      next.items.map((item) => item.id),
      ['c', 'b'],
    )
    assert.equal(next.selectedId, 'b')
  })

  it('selects the first remaining card when a shorter replacement drops the selection', () => {
    const current = {
      items: [image('a'), image('b')],
      nextPageToken: null,
      selectedId: 'b',
    }
    const next = reduceLibrary(current, {
      type: 'replace',
      page: [image('a')],
      nextPageToken: null,
    })

    assert.equal(next.selectedId, 'a')
  })

  it('leaves loaded cards, the page token, and the selection alone when a later page fails', () => {
    const current = {
      items: [image('a'), image('b')],
      nextPageToken: 'next',
      selectedId: 'b',
    }

    assert.equal(reduceLibrary(current, { type: 'failure' }), current)
  })

  it('drops a repeated id inside one page without moving the first copy', () => {
    const page = dedupeAppend([], [image('a'), image('a'), image('b')])
    assert.deepEqual(
      page.map((item) => item.id),
      ['a', 'b'],
    )
  })
})

describe('stale results', () => {
  it('rejects a result from an older request and keeps the current one', () => {
    assert.equal(acceptIfCurrent(1, 2, 'old'), null)
    assert.equal(acceptIfCurrent(2, 2, 'current'), 'current')
  })
})

describe('search hit order', () => {
  it('shows resolved images in server order and skips hits that are not loaded yet', () => {
    const resolved = new Map([
      ['c', image('c')],
      ['a', image('a')],
    ])
    const ordered = imagesInServerOrder(['b', 'a', 'b', 'c'], resolved)
    assert.deepEqual(
      ordered.map((item) => item.id),
      ['a', 'c'],
    )
  })

  it('asks only for ids that are still missing', () => {
    const resolved = new Map([['a', image('a')]])
    assert.deepEqual(unresolvedIds(['a', 'b', 'a', 'c'], resolved), ['b', 'c'])
  })

  it('keeps the first time an id appears when another page repeats it', () => {
    assert.deepEqual(appendUniqueIds(['a', 'b'], ['b', 'c', 'a']), ['a', 'b', 'c'])
  })
})

describe('rendition urls', () => {
  it('sets the size query and leaves a bad url unchanged', () => {
    assert.equal(
      renditionUrl('https://cdn.example.com/img.jpg', 'thumb'),
      'https://cdn.example.com/img.jpg?size=thumb',
    )
    assert.equal(renditionUrl('not a url', 'full'), 'not a url')
  })
})

describe('passage labels', () => {
  it('uses the book title and keeps a range', () => {
    const titles = bookTitlesFromBody(
      JSON.stringify({ data: [{ id: 'JHN', title: 'John' }, { title: '' }, { id: 3 }] }),
    )
    assert.equal(formatPassageLabel('JHN.3.16', titles), 'John 3:16')
    assert.equal(formatPassageLabel('JHN.3.16-18', titles), 'John 3:16-18')
    assert.equal(formatPassageLabel('ROM.8', titles), 'ROM 8')
    assert.equal(formatPassageLabel('not-a-passage', titles), 'not-a-passage')
  })
})

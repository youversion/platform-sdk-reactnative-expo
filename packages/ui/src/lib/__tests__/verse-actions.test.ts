import type { BibleReaderCustomVerseAction } from '../../types/verse-hook-types'
import { DEFAULT_VERSE_ACTIONS, mergeVerseRanges, resolveVerseActions } from '../verse-actions'

function custom(id: string): BibleReaderCustomVerseAction {
  return { id, label: id, icon: () => null, onPress: jest.fn() }
}

const kinds = (items: ReturnType<typeof resolveVerseActions>) =>
  items.map((item) => (item.kind === 'custom' ? item.action.id : item.kind))

describe('resolveVerseActions', () => {
  it('keeps the shipped order by default', () => {
    expect(kinds(resolveVerseActions(DEFAULT_VERSE_ACTIONS, { hasSwatches: true }))).toEqual([
      'swatches',
      'save',
      'copy',
      'share',
    ])
  })

  it('drops save when the host leaves it out', () => {
    expect(kinds(resolveVerseActions(['highlight', 'copy', 'share'], { hasSwatches: true }))).toEqual([
      'swatches',
      'copy',
      'share',
    ])
  })

  it('follows the host order and mixes in custom actions', () => {
    const save = custom('save')
    const items = resolveVerseActions(['share', save, 'copy'], { hasSwatches: true })
    expect(kinds(items)).toEqual(['share', 'save', 'copy'])
    expect(items[1]).toEqual({ kind: 'custom', action: save })
  })

  it('drops highlight when there are no swatches', () => {
    expect(kinds(resolveVerseActions(['highlight', 'copy'], { hasSwatches: false }))).toEqual([
      'copy',
    ])
  })

  it('keeps the first of a duplicate id and warns', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const first = custom('save')
    const items = resolveVerseActions([first, 'copy', custom('save'), 'copy'], {
      hasSwatches: true,
    })
    expect(kinds(items)).toEqual(['save', 'copy'])
    expect(items[0]).toEqual({ kind: 'custom', action: first })
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"save"'))
    warn.mockRestore()
  })

  it('returns nothing for an empty list', () => {
    expect(resolveVerseActions([], { hasSwatches: true })).toEqual([])
  })
})

describe('mergeVerseRanges', () => {
  const scope = { versionId: 111, book: 'JHN', chapter: '3' }

  it('sorts, dedupes, and merges contiguous verses', () => {
    expect(mergeVerseRanges({ ...scope, verses: [18, 16, 5, 17, 16] })).toEqual([
      { ...scope, verseStart: 5, verseEnd: 5, passageId: 'JHN.3.5' },
      { ...scope, verseStart: 16, verseEnd: 18, passageId: 'JHN.3.16-18' },
    ])
  })

  it('returns no ranges for no verses', () => {
    expect(mergeVerseRanges({ ...scope, verses: [] })).toEqual([])
  })
})

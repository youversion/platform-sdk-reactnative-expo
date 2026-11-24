import type { VerseIndicatorTarget } from '../../../types/verse-hook-types'
import { parsePassage } from '../parse-passage'
import { indicatorTarget, resolveIndicators } from '../verse-indicators'

const SCOPE = { versionId: 111, book: 'JHN', chapter: '1' }
const MARKER = { backgroundColor: '#3366ff' }

// Verse 2 has no printed number, as when a version hides it.
const BLOCKS = parsePassage(
  '<div><div class="s1">The Word</div><div class="p">' +
    '<span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>In the beginning ' +
    '<span class="yv-v" v="2"></span>He was with God. ' +
    '<span class="yv-v" v="3"></span><span class="yv-vlbl">3</span>All things</div>' +
    '<div class="p">came to be.</div></div>',
).blocks

describe('resolveIndicators', () => {
  it('is undefined without a resolver', () => {
    expect(resolveIndicators(BLOCKS, SCOPE, undefined)).toBeUndefined()
  })

  it('asks once per labelled verse and skips headings and unlabelled verses', () => {
    const resolver = jest.fn((_target: VerseIndicatorTarget) => MARKER)

    const styles = resolveIndicators(BLOCKS, SCOPE, resolver)

    expect(resolver.mock.calls.map(([target]) => target.verse)).toEqual([1, 3])
    expect([...styles!.keys()]).toEqual([1, 3])
  })

  it('keeps the plain number where the host returns null', () => {
    const styles = resolveIndicators(BLOCKS, SCOPE, (target) => (target.verse === 3 ? MARKER : null))
    expect([...styles!.keys()]).toEqual([3])
  })

  it('is undefined when no verse gets a marker', () => {
    expect(resolveIndicators(BLOCKS, SCOPE, () => null)).toBeUndefined()
  })
})

describe('indicatorTarget', () => {
  it('names the verse as a passage id', () => {
    expect(indicatorTarget(SCOPE, 16)).toEqual({ ...SCOPE, verse: 16, passageId: 'JHN.1.16' })
  })
})

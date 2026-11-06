import * as core from '../../index'
import type {
  UseVerseOfTheDayResult,
  VerseOfTheDayApiError,
  VerseOfTheDayApiResult,
  VerseOfTheDayOptions,
  YouVersionVerseOfTheDay,
  YouVersionVerseOfTheDayPage,
} from '../../index'

function curatedImageId(day: YouVersionVerseOfTheDay): string | null {
  return day.image_id
}

describe('verse of the day package exports', () => {
  it('exposes the verse of the day hook', () => {
    expect(core.useVerseOfTheDay).toEqual(expect.any(Function))
  })

  it('keeps the client wrapper, BibleClient, and ApiClient internal', () => {
    const names = Object.keys(core)
    expect(names).not.toContain('createVerseOfTheDayApi')
    expect(names).not.toContain('BibleClient')
    expect(names).not.toContain('ApiClient')
    expect(names).not.toContain('createApiClient')
    expect(names).not.toContain('DEFAULT_API_HOST')
  })

  it('exports optional language ranges and the typed result', () => {
    const defaults: VerseOfTheDayOptions = {}
    const options = { languageRanges: ['es', 'en'] } satisfies VerseOfTheDayOptions
    const success = {
      ok: true,
      value: { day: 15, passage_id: 'JHN.3.16', image_id: null },
    } satisfies VerseOfTheDayApiResult<YouVersionVerseOfTheDay>
    const failure = {
      ok: false,
      error: { kind: 'not-found', status: 404, message: 'missing' },
    } satisfies VerseOfTheDayApiResult<YouVersionVerseOfTheDay>

    expect(defaults.languageRanges).toBeUndefined()
    expect(options.languageRanges).toEqual(['es', 'en'])
    expect(success.value.image_id).toBeNull()
    expect(failure.error.kind).toBe('not-found')
  })

  it('exports the parsed day, including a required image id', () => {
    const day = {
      day: 15,
      passage_id: 'JHN.3.16',
      image_id: null,
    } satisfies YouVersionVerseOfTheDay
    const page = {
      data: [{ day: 1, passage_id: 'PSA.23.1', image_id: 'img-1' }],
      next_page_token: null,
    } satisfies YouVersionVerseOfTheDayPage
    const missing: VerseOfTheDayApiError = { kind: 'not-found', status: 404, message: 'missing' }
    const hook: UseVerseOfTheDayResult = {
      get: async () => ({ ok: true, value: day }),
      list: async () => ({ ok: true, value: page }),
    }

    expect(curatedImageId(day)).toBeNull()
    expect(page.data[0]?.image_id).toBe('img-1')
    expect(missing.kind).toBe('not-found')
    expect(hook.get).toEqual(expect.any(Function))
  })
})

import type { Collection, GetVOTDOptions, VOTDResponse } from '@youversion/platform-core'

import type { Result } from '../result'

export type YouVersionVerseOfTheDay = VOTDResponse

export type YouVersionVerseOfTheDayPage = Collection<YouVersionVerseOfTheDay>

export type VerseOfTheDayOptions = {
  languageRanges?: GetVOTDOptions['language_ranges']
}

export type VerseOfTheDayApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'not-found'; status: 404; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; status?: number; message: string }

export type VerseOfTheDayApiResult<Value> = Result<Value, VerseOfTheDayApiError>

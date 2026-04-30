/**
 * MSW request handlers for tests. Mirrors the approach used in
 * `platform-sdk-react`: intercept HTTP at the fetch layer so the real
 * `@youversion/platform-react-ui` + `@youversion/platform-react-hooks`
 * internals run, but no real network calls leave the box.
 *
 * The YouVersion API host is `api.youversion.com` and the default
 * license-free Bible version is `3034`.
 */

import { http, HttpResponse } from 'msw'

const API = 'https://api.youversion.com'

// --- Mock data --------------------------------------------------------------
export const mockVOTD = {
  day: 1,
  passage_id: 'JHN.3.16',
}

export const mockPassageJHN316 = {
  id: 'JHN.3.16',
  reference: 'John 3:16',
  content:
    '<div data-usfm="JHN.3.16">For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have everlasting life.</div>',
}

export const mockVersionNIV = {
  id: 3034,
  abbreviation: 'NIV',
  localized_abbreviation: 'NIV',
  title: 'New International Version',
  local_title: 'New International Version',
  language: { id: 'eng', name: 'English' },
}

// --- Default ("happy path") handlers ---------------------------------------
export const handlers = [
  // Verse of the Day by day number
  http.get(`${API}/v1/verse_of_the_days/:day`, ({ params }) => {
    return HttpResponse.json({ ...mockVOTD, day: Number(params.day) })
  }),

  // Passage lookup (any version, any USFM ref)
  http.get(`${API}/v1/bibles/:versionId/passages/:usfm`, ({ params }) => {
    return HttpResponse.json({
      ...mockPassageJHN316,
      id: String(params.usfm),
    })
  }),

  // Bible version metadata
  http.get(`${API}/v1/bibles/:versionId`, ({ params }) => {
    return HttpResponse.json({
      ...mockVersionNIV,
      id: Number(params.versionId),
    })
  }),
]

/**
 * Tests for the VerseOfTheDay Expo DOM component wrapper.
 *
 * The component is a thin wrapper that renders the real `YouVersionProvider`
 * and `VerseOfTheDay` from `@youversion/platform-react-ui`. Those components
 * (and the underlying `@youversion/platform-react-hooks`) drive `BibleClient`
 * which calls the YouVersion HTTP API.
 *
 * To exercise the real internals without hitting the live API, we intercept
 * HTTP at the fetch layer with MSW (mirroring the platform-sdk-react setup).
 *
 * Test environment: `jest-fixed-jsdom` (a jsdom variant that keeps Node's
 * built-in fetch / Request / Response / TextEncoder / ReadableStream so MSW
 * + undici can run). Resolution uses `customExportConditions: ['']` so
 * `msw/node` resolves correctly under jsdom.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from './msw/server'

import VerseOfTheDayDOM from '../src/dom/verse-of-the-day'

// jsdom doesn't ship `ResizeObserver`, but the AnimatedHeight component
// inside `<VerseOfTheDay>` uses it.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverMock

const API = 'https://api.youversion.com'

describe('VerseOfTheDayDOM (happy path)', () => {
  it('renders the verse copy and reference returned by the API', async () => {
    render(<VerseOfTheDayDOM appKey="test-app-key" />)

    // The "Verse of the Day" section header renders synchronously.
    expect(
      screen.getByText(/verse of the day/i),
    ).toBeInTheDocument()

    // The verse text + reference come from the mocked API responses.
    expect(
      await screen.findByText(/For God so loved the world/i),
    ).toBeInTheDocument()
    expect(await screen.findByText(/John 3:16 NIV/)).toBeInTheDocument()
  })

  it('respects the dayOfYear prop when fetching the VOTD', async () => {
    const dayCalls: string[] = []
    server.use(
      http.get(`${API}/v1/verse_of_the_days/:day`, ({ params }) => {
        dayCalls.push(String(params.day))
        return HttpResponse.json({ day: Number(params.day), passage_id: 'JHN.3.16' })
      }),
    )

    render(<VerseOfTheDayDOM appKey="test-app-key" dayOfYear={42} />)

    await waitFor(() => expect(dayCalls).toContain('42'))
  })

  it('uses the provided versionId when fetching the passage', async () => {
    const passageCalls: string[] = []
    server.use(
      http.get(`${API}/v1/bibles/:versionId/passages/:usfm`, ({ params }) => {
        passageCalls.push(String(params.versionId))
        return HttpResponse.json({
          id: String(params.usfm),
          reference: 'John 3:16',
          content: '<div>verse</div>',
        })
      }),
    )

    render(<VerseOfTheDayDOM appKey="test-app-key" versionId={111} />)

    await waitFor(() => expect(passageCalls).toContain('111'))
  })

  it('hides the share button when showShareButton=false', async () => {
    render(
      <VerseOfTheDayDOM appKey="test-app-key" showShareButton={false} />,
    )

    await screen.findByText(/For God so loved the world/i)
    expect(screen.queryByLabelText('Share')).not.toBeInTheDocument()
  })

  it('shows the share button by default', async () => {
    render(<VerseOfTheDayDOM appKey="test-app-key" />)

    await screen.findByText(/For God so loved the world/i)
    expect(screen.getByLabelText('Share')).toBeInTheDocument()
  })
})

describe('VerseOfTheDayDOM (error path)', () => {
  it('does not render the reference text when the VOTD endpoint fails', async () => {
    server.use(
      http.get(`${API}/v1/verse_of_the_days/:day`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )

    render(<VerseOfTheDayDOM appKey="test-app-key" />)

    // Header still renders.
    expect(screen.getByText(/verse of the day/i)).toBeInTheDocument()

    // Verse text never appears because the upstream fetch errored out.
    await waitFor(() => {
      expect(
        screen.queryByText(/For God so loved the world/i),
      ).not.toBeInTheDocument()
    })
    // Reference text from a successful passage call shouldn't appear either.
    expect(screen.queryByText(/John 3:16 NIV/)).not.toBeInTheDocument()
  })

  it('disables the share button when the passage endpoint fails', async () => {
    server.use(
      http.get(`${API}/v1/bibles/:versionId/passages/:usfm`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )

    render(<VerseOfTheDayDOM appKey="test-app-key" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Share')).toBeDisabled()
    })
  })

  it('fails fast on any unmocked YouVersion API request', async () => {
    // The MSW server is configured with `onUnhandledRequest: 'error'`, so
    // any new endpoint added to the SDK without a corresponding handler will
    // surface as a noisy console error during tests rather than a slow,
    // flaky live request in CI. This test uses the default handlers (from
    // handlers.ts) which cover every YouVersion endpoint the component calls,
    // proving no unhandled requests occur on a clean run.
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    render(<VerseOfTheDayDOM appKey="test-app-key" />)

    await screen.findByText(/For God so loved the world/i)

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

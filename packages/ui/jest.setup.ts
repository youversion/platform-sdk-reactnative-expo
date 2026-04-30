import { randomUUID } from 'node:crypto'
import '@testing-library/jest-dom'
import { server } from './__tests__/msw/server'

// jsdom provides crypto.getRandomValues but not crypto.randomUUID.
// platform-core calls crypto.randomUUID() for installation IDs.
if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: randomUUID,
    writable: true,
    configurable: true,
  })
}

// MSW lifecycle. `error` ensures any unmocked request fails the test instead
// of silently hitting the real YouVersion API.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

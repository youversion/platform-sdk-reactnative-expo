/** Normalize Jest / RN fetch inputs to a URL string. */
export function fetchUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) {
    return input.href
  }
  if (input instanceof Request) {
    return input.url
  }
  return input
}

/**
 * Replace `global.fetch` for matching URLs. Return a Response (or promise) to
 * stub; return `undefined` to fall through to the previous fetch.
 */
export function stubFetch(
  match: (url: string) => Response | Promise<Response> | undefined,
): () => void {
  const prior = global.fetch
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const result = match(fetchUrl(input))
    if (result !== undefined) {
      return Promise.resolve(result)
    }
    return prior(input, init)
  })
  return () => {
    global.fetch = prior
  }
}

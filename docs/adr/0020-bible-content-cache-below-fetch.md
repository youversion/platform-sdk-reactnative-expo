# 20. The Bible Content Cache sits below `fetch`, served by native, in MMKV

Date: 2026-08-27 (amended 2026-08-29: native performs the request)

## Status

Accepted

## Context

The Swift and Kotlin SDKs cache Bible content in three tiers — memory, a `Caches`/`cacheDir` disk cache with a `.expiration` sidecar per file, and user downloads — and obey `Cache-Control: max-age` on the first two (YPE-4392, YPE-4393). This SDK had no content cache at all: every reader mount hit the network (YPE-5262).

The Web SDK's `ApiClient` calls the global `fetch` inside each Expo DOM Component's WebView. React SDK PR #360 moves `useApiData` onto TanStack Query with a QueryClient that is created inside the Web SDK's `YouVersionProvider` as private state and deliberately not exposed, with `staleTime: 0` and a memory-only cache (upstream ADR 0006 rejects persisters).

The SDK is moving off WebViews toward native rendering. Anything built inside the WebView is throwaway; anything built on native is kept.

## Decision

**The cache is a `fetch` interception in the WebView that hands the request to native, not a query persister and not a WebView-side cache.** `ensureDomContentCache()` is installed beside `ensureDomLocalStorage()` before the Web SDK loads. An eligible GET — host equals the component's `apiHost`, path under `/v1/bibles/{id}` — never leaves the WebView as HTTP. Its `pathname + search` crosses one Native Action, `fetchBibleContent`, and the WebView rebuilds a `Response` from the `{ status, body, contentType }` that comes back. TanStack Query — or today's `useState` — stays above the interception and is unaware of it. `persistQueryClient` was rejected: the QueryClient is unreachable without an upstream change, its `maxAge` is per-blob rather than per-entry, and with `staleTime: 0` a hydrated query refetches on mount anyway, which is stale-while-revalidate, not obedience.

**Native owns the request.** The Bible Content Client in core composes the headers from core's own configuration (`X-YVP-App-Key`, `X-YVP-Installation-Id`, `X-YVP-Sdk` — the SDK stamp moves from `ui` into `core`), reads the store, fetches on a miss, parses `Cache-Control`, writes, and returns the response. Nothing the WebView sent is forwarded: native is authoritative on host and headers, so the client's surface is `fetch(path)`, which a native-only reader will call unchanged. An earlier cut of this decision kept the network in the WebView and exposed two cache actions (`readBibleContent` / `writeBibleContent`); it was replaced because it left the HTTP client, header composition, and lifetime parsing in code that will be deleted with the WebView. platform-core's `BibleClient` is not reused: `ApiClient.get` hides the `Response`, so `Cache-Control` cannot be read through it.

**There is no WebView-side network fallback.** A native throw — offline miss, timeout, missing action — rejects the WebView's `fetch` with a `TypeError`, the same shape a browser network error has. A fallback would be a second HTTP client whose only job is to hide bugs in the first.

**The native tier is MMKV, one instance per version.** `yv-bible-content-<versionId>` holds `{ body, expiresAt }` per key; the list of version ids lives in `yv-platform`, the way Swift lists `bible_*` directories. The key is `apiHost + pathname + search`, unhashed; the app key is not part of it. Per-version instances bound what MMKV maps into memory and let the sweep and a future permission pass drop a version in one call. `expo-file-system` was rejected for now to avoid a new native dependency before a downloads tier exists.

**This is a deliberate deviation from Swift's disk cache.** MMKV lives in `Documents/mmkv` on iOS and `filesDir/mmkv` on Android — never purged by the OS under storage pressure, and included in backups — whereas Swift and Kotlin use the purgeable, unbacked-up cache directory. The only eviction is the lifetime rule: expiry on read, plus a Content Sweep once per core `YouVersionProvider` mount. If backup size or memory mapping ever becomes a real cost, the migration is to `expo-file-system`'s cache directory behind the same client.

**The lifetime rules are Swift's, verbatim.** `max-age − Age`, clamped at zero; seven days when `max-age` is missing or unparseable; `no-cache`/`no-store` matched by directive name and never written; `Expires` and `Date` ignored. An expired read deletes the entry and misses — a blocking refetch, no stale-while-revalidate. Not purged on sign-out: content is scoped to the app key, not the user.

## Consequences

- A reader mounts from MMKV without a network call for up to `max-age` (24h today) — the ticket's goal — with no change to the React SDK. `fetch?: typeof fetch` on upstream `ApiConfig` is a nicety, not a dependency.
- The memory tier is per WebView and dies with it; the native tier is the one that carries state across mounts. Once #360 lands, `gcTime` per query is capped at the remaining Content Lifetime so the memory tier can never outlive the header.
- One Native Action crosses the bridge on every eligible request, carrying the path out and the whole body back. A hit costs one MMKV read and one bridge round trip; a miss adds the network on the native side.
- Every DOM component carries the action, because eligibility is a path rule, not a component list. BibleCard and Verse of the Day passages are cached like chapters; `/v1/bibles` and `/v1/verse_of_the_days` pass through.
- When the WebView goes, `dom-content-cache.ts` and the action prop are deleted; the client, the store, the lifetime parser, and the sweep stay.
- Native VOTD now sends `X-YVP-Sdk`, which it did not before.
- Bible text is backed up with the app and never OS-evicted. Space is bounded by the lifetime rule alone.
- Switching `apiHost` never serves the other host's text; switching app key on the same host may serve a version the new key cannot see until it expires. A permission-eviction pass (Swift's `removeUnpermittedVersions`) is out of scope here.
- Downloads remain out of scope; nothing here is user-owned or non-expiring.

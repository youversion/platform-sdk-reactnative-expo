---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Bible highlights on native. The reader paints the signed-in user's highlights, verse actions are a native bottom sheet, highlights made offline survive a relaunch and land on their own, and a user who taps a color before signing in or granting the permission gets their highlight rather than losing it.

## Action required

Three native modules are new peer dependencies. They are autolinked, so a JS-only reload leaves a `Cannot find native module` redbox — install them and rebuild your dev client.

```bash
npx expo install expo-network expo-clipboard expo-application
```

`expo-network` is core's (the connectivity trigger for parked writes). `expo-clipboard` is UI's (the Copy fallback in the verse action sheet). `expo-application` is now a UI peer too — apps already using core have it.

**The Bible reader's default serif font changes from Source Serif 4 to Untitled Serif**, YouVersion's brand serif, following the Web SDK. A DOM component's WebView now makes a new outbound request to `api.youversion.com` for the stylesheet plus woff2 fetches from `cdn.youversion.com`. There is no opt-out and no new prop; if those hosts are blocked, serif text falls back to Source Serif 4 with no layout break. Readers who had explicitly chosen Source Serif are migrated. Any other `fontFamily` you pass or persist is left untouched.

## Reading and writing highlights

`useHighlights({ versionId, book, chapter })` is the whole public surface for highlights. It paints from an MMKV cache synchronously on first render, so a cold start has no blank frame; applies and removes optimistically; reconciles against the server; and reverts writes the server refuses.

`apply(color, verses)` and `remove(color, verses)` resolve a typed `HighlightWriteOutcome` — `ok`, `noop`, `queued`, or `error` with a `reason` of `not-signed-in` / `auth` / `invalid` / `transient`, plus `failedVerses` and `succeededVerses` so a partially applied batch is legible. Highlights come back as per-verse `Highlight[]`, ready for a controlled reader. `error` on the hook itself is fetch-only; writes report through the outcome they resolve to.

Also exported: `deriveServerColors` (projects the returned highlights to a verse → color map), `HIGHLIGHT_COLORS` and `isHighlightColor` (the five company-standard swatches — both write paths reject anything else), `refresh()` for pull-to-refresh, and the `Highlight` / `HighlightColor` / `HighlightScope` / `ServerColors` types. `isRefreshing` is named for "a GET is in flight" rather than `isLoading`, because `highlights` is always safe to render — gating a spinner on it would reintroduce the blank frame the cache exists to prevent.

The GET is gated on the app having **requested** the `highlights` permission (`auth.permissions` on `YouVersionProvider`). An app that renders a reader and never asked for highlights issues no highlights request at all. The gate reads the requested list, never a grant: a missing grant is indistinguishable from an unknown one, and treating unknown as denied would silently un-paint the highlights of users who signed in before grant reporting existed.

## Highlights made offline

A highlight tapped without service keeps its paint instead of un-painting and reporting an error, is persisted per user and chapter so it is still there after a force-quit and relaunch, and reaches the user's account on its own once service returns.

Which failures park and which revert:

- **Unreachable, or a 5xx** — the paint stands and the write parks. `apply` and `remove` resolve `{ status: 'queued', verses }`.
- **Refused: 401, 403, or any other 4xx** — the paint reverts to what the server has, and the outcome reports the refusal.

Writes are persisted before they are sent, so the paint never has a gap and an app killed mid-request still owes the write. At mount the paint comes from the cache with the queue re-applied over it, which repairs a crash between those two writes. A second tap on a verse that already has a parked write overwrites it rather than stacking, and a write whose end state matches what is already stored cancels out without ever becoming a request — so applying and then removing the same verse offline leaves nothing behind.

`queued` reports the write you just made, not the verse's history, so **it repeats**: tapping a verse that is still parked resolves `queued` again, and the outcome does not tell you whether that verse was already waiting. Show "saved offline" once by holding that in your own state — a batch can mix a parked verse with fresh ones, and a verse parked yellow then tapped green is a new write rather than a repeat, so there is no single flag the SDK could hand back that would be true.

Parked writes land with no user action and nothing on screen changing at the moment they do. A write made in John 3 lands while the reader is in Romans 8, and lands even if the user never returns to John 3. The drain is owned by core's `YouVersionProvider` and is inert with no auth configured, no signed-in user, or no access token. It wakes on provider mount, on a token change, on the app returning to the foreground, on the rising edge of connectivity, and on a successful highlights fetch; otherwise each parked verse retries on its own widening, capped backoff that resets when it lands. Any wake-up retires the pending wait, so a write deep into its backoff goes out the moment service returns rather than sitting out the rest of it. Connectivity is a trigger, never a gate — a wrong or missing connectivity answer costs a delayed attempt, never a skipped one.

A write the server will never accept — reachable by calling `useHighlights` directly without the permission flow, or by a `highlights` grant revoked between the tap and the drain — stops being painted rather than sitting on the device forever. A 401 or 403 earns a forced token refresh and one more attempt; the ordinary expired-token case is cured by that and lands normally. Only a **second** auth refusal under a freshly minted token drops the entry, reverting the verse to the color the server had and un-painting on a reader that is still mounted, with no remount and no user action. Nothing else drops: network failures, 5xx, and non-auth 4xx retry indefinitely. A forced refresh that fails, or one that ends the session the write belongs to, drops nothing.

Signing out drops every write still waiting, in the same routine that clears the highlights cache and the granted-permission cache — which a revoked refresh token also runs, so a dead session takes the parked writes with it. A write parked on one account can never land on the next one signed in on the device. The purge takes every user's parked writes, not only the departing user's: one user is signed in at a time, so an entry under any other id was already left behind by an earlier departure and has no session that could send it. Entries stay keyed per user while a user is signed in, and a user change part-way through a drain stops the pass rather than sending the departed user's writes under the new token.

## Highlighting before signing in

`useHighlightPermissionFlow({ versionId, book, chapter })` composes `useHighlights` with the auth context and guards `apply` behind whatever is missing: it holds the pending highlight in memory, runs sign-in and/or the just-in-time consent grant, and applies the highlight on the way back. `remove` is unwrapped and passes straight through — a user with visible highlights already has the grant.

It returns the underlying `useHighlights` result untouched (render `highlights` from it as before), plus `isConfirming` to drive a consent prompt, `confirm()` / `decline()` to answer it, and `flowError` for the one thing worth a toast. `apply` resolves with the write's own outcome when a write was issued, `noop` when the user abandoned the flow, and an `error` when the flow itself failed — so a cancel or a decline never reads as something going wrong.

The branch point is a **pre-flight permission read, not a write's 401/403**: branching on the failure reason would burn a failed round-trip before every first highlight. A write refused with `reason: 'auth'` anyway means the cached grant was stale, so the grant is invalidated and the user is re-prompted — **exactly once**, never in a loop. A `queued` write passes straight back to the caller: a user who signs in, grants, and then taps with no service gets their paint, not a re-prompt. Every dismissal path discards the pending highlight cleanly, a grant that comes back without `highlights` does not write, and the pending highlight carries the passage it was tapped in, so nothing resumed after the reader changes chapters can paint verses onto text the user never selected.

Requires `auth` on `YouVersionProvider` and the `highlights` permission (a permission, never a scope). With no `auth` configured the flow behaves exactly as signed out, and says so once in development.

## Permissions

The auth context now reports which permissions the user granted, and can ask for one without signing out.

`useYVAuth()` adds `grantedPermissions`, `hasPermission()`, and `invalidatePermissions()`. `grantedPermissions` has three states: `null` means the app never requested permissions, `[]` means it requested them and the user denied, and a populated list means the user granted those. The SDK reads the grant from the OAuth app redirect, caches it per user in MMKV, loads it on cold start, and clears it on sign-out. `AuthPermission` is now an open union (`KnownAuthPermission | (string & {})`), so `AuthConfig.permissions` and `hasPermission()` accept a permission this SDK version does not know about, and the cache keeps every value the server returns rather than filtering. `requestedPermissions` carries the configured list alongside it — what was asked for, as against what came back.

`requestPermissions(permissions)` lets a signed-in user grant a permission on the spot: it mints a data-exchange token, runs YouVersion's hosted consent page in an auth session, and merges what the user granted into the cache, so `hasPermission` answers true on the next render. It resolves a typed `DataExchangeOutcome` rather than throwing — `granted` (carrying the permissions the server actually reported, which may be fewer than were asked for), `cancel`, or `failure` with a `reason` of `not-signed-in`, `not-permitted` (this app key is not enabled for data exchange, deliberately distinct from a flaky network), `user-changed`, `in-progress` (another request holds the flow — wait for it rather than retrying straight away), or `transient`. The grant merges rather than replaces, so consenting to one permission never erases another; `cancel` and `failure` leave the cache untouched; and an initiator guard discards a grant that lands after the signed-in user changed, because a mis-attributed grant is invisible while a discarded one just re-prompts. The flow is permission-generic — nothing about it is specific to highlights.

The consent page returns to your `redirectUri`, the same callback URL sign-in uses, because an app key has exactly one — so data exchange needs no setup beyond what sign-in already required. If the two disagree the return never reaches the SDK and the outcome is `cancel`, indistinguishable from a decline. That is the first thing to check when grants do not stick.

The cached grant is a hint for choosing UI and skipping redundant prompts. The server enforces; gate a privileged action on the pre-flight, not on a cached `true`.

## Tokens

Two additions to the auth context, both public:

- `ensureFreshToken()` — the leeway-gated refresh, cheap enough to await on every user gesture, unlike `refreshNow()` which always hits the token endpoint.
- `getAccessToken()` — the accessor that reports whether the refresh worked. It runs the same leeway-gated, single-flight refresh, then resolves an `AccessTokenResult`: `{ status: 'ok', token, userId }`, or `{ status: 'unavailable', reason: 'signed-out' | 'refresh-failed' }`. It never rejects, makes no network call when there is no refresh token to spend, and concurrent callers join one refresh. The `userId` is read in the same synchronous block as the token, so a caller holding an identity it captured earlier can tell whether the token it just got still belongs to that user — `userInfo` read from a render lags the token by a render on sign-in.

`refresh-failed` leaves the tokens in storage: the session is intact and the user stays signed in. That matters because a token endpoint outage used to present to the user as a revoked permission. When the token was expired and the refresh failed for a reason that was not a revocation — a 5xx, a timeout, a captive portal — the write went out with the expired token anyway, came back 401, and the 401 read as a stale grant, so a valid `highlights` grant was invalidated and the user was asked to consent again; the re-consent minted with the same expired token and dead-ended as `not-permitted`. Both the highlights write path and `requestPermissions` now source their token from `getAccessToken()` and settle a `refresh-failed` as `transient` **without issuing the request**.

## The reader

`BibleReader` renders natively-owned highlights and replaces the in-WebView verse action popover with a native bottom sheet. It subscribes to `useHighlights` for its current version / book / chapter and feeds the result in as a controlled prop; because the cache read is synchronous, highlights are in the very first props. Nothing about the highlight path runs inside the WebView any more — no network calls, no local store, no auth surface.

Selecting a verse raises a native sheet with the localized reference, the highlight color swatches, Copy, and Share. There is nothing to enable: no new prop, no opt-in.

- **Highlight swatches.** A remove circle for every color present on any selected verse, then an apply circle for each of the five palette colors. Writes go through the same service as `useHighlights`, so the passage repaints at once and the sheet closes.
- **Sign-in and permission prompts.** The sheet asks a signed-out user, or one without the `highlights` permission, for exactly what is missing, then applies their color choice with no reselecting of the verse. This needs an `auth` config that requests the `highlights` permission; without one, the swatches behave as they do for a signed-out user.
- **Copy and Share.** They fall back to `expo-clipboard` and React Native's `Share`. Two new optional props on `BibleReader`, `onCopy` and `onShare`, take either one over. Both receive the `BibleReaderShareData` this package re-exports.

**The sheet has no backdrop, and that is deliberate.** A backdrop intercepts the second verse tap, and extending a selection one verse at a time is the point. The consequence is that a tap outside does not dismiss the sheet — swipe down, deselect the verses, or act on the sheet. Every themed bottom sheet in the SDK now draws an upward drop shadow, so a sheet without a backdrop still separates from the content behind it.

Two new props carry selection across the bridge:

- `onVerseSelect(selection)` fires on every selection change, including clears (`verses: []`). The payload carries `versionId`, `book`, `chapter`, `verses`, `passageIds`, a localized `reference` (`Hebrews 11:4`, not `HEB 11:4`), and `shareData` — all bridge-safe primitives.
- `clearSelectionSignal` dismisses the current selection from native. Increment it; the value at mount is the baseline, so mounting never clears. A counter rather than an imperative ref handle because only serializable props cross the DOM bridge.

`BibleReaderVerseSelection` and `BibleReaderShareData` are re-exported so a handler can be typed without depending on `@youversion/platform-react-ui` directly.

**The reader now asks before it signs anyone out**, matching the Swift SDK. Sign-out from the user menu raises a native alert instead of signing out on the spot; it is destructive here — it drops the access token, the cached user, the granted permissions, the highlights cache, and every highlight write still waiting — and the menu item sits one tap away from the reader. Two variants: an ordinary confirmation, or "Save your highlights?" when the queue still holds unsent work, which is what a user sees when a highlight was made offline and the drain has not landed it yet. All strings are localized through the SDK's own catalog. The confirmation is the reader's, and it is the only place the SDK offers sign-out — `YouVersionAuthButton` and `useYVAuth().signOut()` are unchanged and still sign out immediately, which is what a host app's own confirmation flow needs. Core exports `hasQueuedHighlightWrites(userId)` for the variant choice; it reads the write queue directly and never throws, so an unreadable store answers "nothing to lose" rather than breaking the gesture that raises the prompt.

**Web.** Native verse actions and the sign-out confirmation are not available on web in this release. `NativeSheet` renders nothing there, so suppressing the popover would leave the reader with no verse action UI at all — the Web SDK popover is what web gets. React Native Web's `Alert.alert` is a no-op, so web signs out unprompted rather than leaving the menu item doing nothing.

## Fixes

- **A token refresh already in flight was skipped rather than joined.** `refreshToken` tracked its in-flight request with a boolean, so a second caller returned immediately, resolving on the very token the refresh existed to replace. The common trigger is ordinary: the app comes to the foreground, the `AppState` listener starts a refresh, and the user acts a moment later — anything auth-sensitive in that window read the expired token and got a 401. It now holds the request as a promise and hands it to the second caller.
- **`signOut()` rejected on a device store that refuses writes.** Clearing the session ends by saving null tokens, and that save wrote the cached token expiry unguarded, so a storage failure threw after the in-memory session and the stored tokens were already gone — the caller saw a rejected promise for a sign-out that had completed. The expiry is a cache over the tokens, which are the record, so it can no longer fail the save; a lost expiry costs one token refresh, because a missing one already reads as expired. The same failure leaves the cached user info readable, and the next launch seeds it back before auth settles; the tokens live in a different store and their removal takes, so the launch finds no refresh token and clears the identity regardless. `isAuthenticated` and `isLoading` remain the signals to gate on.
- **`refreshToken` is now total.** Its revocation branch awaited `clearAuthState()`, which ends in a Keychain delete that can reject; that rejection escaped through `ensureFreshToken`, `getAccessToken`, and `requestPermissions`, all three documented never to throw. Clearing is now best-effort, matching the retention policy everywhere else.
- **The verse action sheet's swatch tray did not scroll on Android**, making hidden swatches unreachable by touch. Six fit the tray, and a selection spanning two existing highlight colors already produces seven. `@gorhom/bottom-sheet` builds its pan gesture with no activation criteria, so `react-native-gesture-handler` fell back to a direction-agnostic touch slop: a sideways drag activated the sheet's pan, which cancels the touch stream in every native view underneath it. The sheet now constrains that pan to vertical intent. Swipe-down dismissal is unchanged.
- Localization synced from platform-localization (ace9bbd).

## Dependencies

The Web SDK dependencies move to 2.5.0 — `@youversion/platform-core` (core, from 2.3.0) and `@youversion/platform-react-ui` (UI, from 2.2.0), which brings `@youversion/platform-core` and `@youversion/platform-react-hooks` 2.5.0 with it, so a single copy of each resolves across the workspace. Beyond the serif font change noted above, it supplies the reader's controlled highlights mode, the data-exchange primitives behind the just-in-time grant, and a core `ApiClient` fix reading an empty-body 2xx (what a successful highlight DELETE returns) as success rather than failure.

---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Bible highlights on native. The reader paints the highlights of the signed-in user. Verse actions are a native bottom sheet. Highlights made offline survive a relaunch and land on their own. A user who taps a color before sign-in or grant still gets that highlight.

## Action required

Install three new peer modules and rebuild the dev client. A JS-only reload shows `Cannot find native module`.

```bash
npx expo install expo-network expo-clipboard expo-application
```

- `expo-network` is a core peer. It wakes parked writes when connectivity returns.
- `expo-clipboard` is a UI peer. It is the Copy fallback in the verse action sheet.
- `expo-application` is a UI peer. It supplies the app name on the sign-in sheet. Core no longer depends on it.

CAUTION: The default serif font of the reader changes from Source Serif 4 to Untitled Serif. The WebView fetches a stylesheet from `api.youversion.com` and font files from `cdn.youversion.com`. There is no opt-out. If those hosts are blocked, serif text falls back to Source Serif 4. Readers who chose Source Serif are migrated. Any other `fontFamily` you pass is left untouched.

## BibleReader

`BibleReader` owns highlights on native. It reads `useHighlights` for the current passage and passes the result as a controlled prop. The WebView does not fetch highlights, store them, or hold a token.

A verse selection opens a native sheet with the reference, color swatches, Copy, and Share. No new prop turns this on.

- Swatches: a remove circle for each color on the selection, then an apply circle for each of the five palette colors.
- Sign-in and consent: the sheet asks for whatever is missing, then applies the chosen color. This needs `auth.permissions` to include `highlights`.
- Copy and Share fall back to `expo-clipboard` and React Native `Share`. Optional `onCopy` and `onShare` take either over. Both receive `BibleReaderShareData`.

The sheet has no backdrop. A backdrop blocks the next verse tap. The user dismisses the sheet with a swipe down, a deselect, or an action on the sheet. Themed sheets draw an upward drop shadow so the sheet still separates from the page.

Selection across the bridge:

- `onVerseSelect(selection)` fires on every change, including a clear (`verses: []`).
- `clearSelectionSignal` dismisses the selection from native. The host increments the value. The value at mount is the baseline.

`BibleReaderVerseSelection` and `BibleReaderShareData` are re-exported from this package.

`ref.refreshHighlights()` re-fetches the current passage. A screen that regains focus can call it.

`onHighlightError` reports `{ status: 'queued' }` and `{ status: 'error', reason: 'transient' }` only. Other outcomes stay silent. The `HighlightWriteError` type is exported.

Sign-out from the reader menu and from `YouVersionAuthButton` asks first. If parked writes are still waiting, the alert is "Save your highlights?". The Confirm action calls `signOut()`. `useYVAuth().signOut()` still signs out at once. `useSignOutGuard` is exported for a host sign-out UI. `hasQueuedHighlightWrites(userId)` chooses the alert variant and never throws.

On web, the Web SDK popover is the verse-action UI. Sign-out is unprompted because `Alert.alert` is a no-op on React Native Web.

## useHighlights

`useHighlights({ versionId, book, chapter })` is the public surface for highlight data. It paints from an MMKV cache on the first render. `apply` and `remove` are optimistic. If the server refuses a write, the paint reverts.

`apply` and `remove` resolve a `HighlightWriteOutcome`: `ok`, `noop`, `queued`, or `error`. An `error` carries `reason` (`not-signed-in` / `auth` / `invalid` / `transient`) plus `failedVerses` and `succeededVerses`. The hook `error` is fetch-only.

Also exported: `deriveServerColors`, `HIGHLIGHT_COLORS`, `isHighlightColor`, `refresh()`, and the `Highlight` / `HighlightColor` / `HighlightScope` / `ServerColors` types.

`apply` accepts only the five palette colors. A valid non-palette hex already on the account paints and clears by exact value. An unparseable hex is dropped.

`isRefreshing` means a GET is in flight. `highlights` is always safe to render. Mounted subscriptions also refresh when the app becomes active.

The GET runs only for an app that requested the `highlights` permission on `YouVersionProvider`. The gate reads the requested list, not a grant.

## Offline writes

A tap with no service keeps its paint and parks the write. The write is stored per user and chapter. It survives a relaunch. When service returns, the write lands.

- Unreachable or 5xx: paint stands. Outcome is `{ status: 'queued', verses }`.
- 401, 403, or any other 4xx: paint reverts. Outcome reports the refusal.

`queued` repeats on every tap of a verse that is still parked. If you show "saved offline" once, hold that copy in your own state.

Sign-out drops every parked write with the highlights cache and the grant cache. A write parked on one account cannot land on the next account.

A 401 or 403 on the drain earns one forced refresh and one retry. Only a second auth refusal under a minted token drops the entry. A failed force drops nothing.

## Highlighting before sign-in

`useHighlightPermissionFlow` wraps `useHighlights` and guards `apply`. It holds the pending highlight, runs sign-in and/or consent, then applies. `remove` passes through.

It returns the `useHighlights` result plus `isConfirming`, `confirm()`, `decline()`, and `flowError`. A cancel or decline resolves `noop`. `BibleReader` already wires the prompts. This hook is for a custom highlight UI.

This needs `auth` on `YouVersionProvider` and the `highlights` permission. With no `auth`, the flow behaves as signed out.

## Permissions and tokens

`useYVAuth()` now reports `grantedPermissions`, `hasPermission()`, `invalidatePermissions()`, and `requestedPermissions`. `grantedPermissions` is `null` (unknown), `[]` (denied), or a list (granted). The grant is read from the OAuth app redirect and cached per user.

`requestPermissions(permissions)` asks a signed-in user for a grant without sign-out. It resolves a `DataExchangeOutcome` and never throws: `granted`, `cancel`, or `failure` (`not-signed-in` / `not-permitted` / `user-changed` / `in-progress` / `transient`). The grant merges. The consent page returns to your `redirectUri`. If that URI does not match the registered callback, the outcome is `cancel`.

The cached grant is a hint. A privileged action gates on the pre-flight, not on a cached `true`.

`getAccessToken(options?)` resolves `{ status: 'ok', token, userId }` or `{ status: 'unavailable', reason: 'signed-out' | 'refresh-failed' }`. It refreshes only near expiry unless you pass `{ force: true }`. It never rejects. `refresh-failed` keeps the session. Highlights writes and `requestPermissions` treat `refresh-failed` as `transient` and do not send the request.

## Dependencies

`@youversion/platform-core` and `@youversion/platform-react-ui` move to 2.6.2. That release supplies controlled highlights, data-exchange primitives, and a fix that reads an empty-body 2xx DELETE as success.

# React Native Expo SDK Composition

Language for composing React Web SDK Bible experiences into React Native Expo apps. Preserves the boundary between Web SDK content, Expo DOM adapters, and native presentation/state.

## Language

**React Web SDK Component**:
A component from `@youversion/platform-react-ui` that owns web-first Bible UI behavior and semantics.
_Avoid_: Web component, upstream component

**Expo DOM Component**:
A `'use dom'` wrapper that renders React Web SDK content inside Expo's DOM/WebView runtime on native. Native provider context does not cross the WebView — each wrapper keeps its own web `YouVersionProvider`.
_Avoid_: WebView component, DOM view

**Native Wrapper**:
A React Native component that owns native-facing API, coordination state, and native presentation around one or more Expo DOM components.
_Avoid_: Container, adapter

**Presentation Shell**:
The platform-specific surface that displays reusable content, such as a Radix Popover on web or a NativeSheet on mobile.
_Avoid_: Modal, popup

**Native Sheet**:
The React Native bottom-sheet presentation shell used for mobile interactions that should not use a web popover. Closing it dismisses a keyboard raised by its Expo DOM content only when that content receives `isOpen` and calls `useDismissKeyboardOnClose`. See [ADR 0010](docs/adr/0010-dom-keyboard-dismissal-on-sheet-close.md).
_Avoid_: Modal; treating keyboard dismiss as automatic native `Keyboard.dismiss()`

**Inactive Sheet Inertness**:
A **Native Sheet** requirement: before a sheet-opening user action, an inactive sheet must not be visible, draggable, touch-blocking, or otherwise in the user's way. Keeping DOM content mounted for WebView pre-warming is acceptable only while this requirement holds.

Implementation note: inactive Gorhom hosts may remain mounted for pre-warming, but their native host is pushed below the visible viewport, with sheet chrome, gestures, pointer events, and accessibility exposure disabled until active.
_Avoid_: Treating a closed sheet host as harmless just because `index={-1}`

**Sheet Surface Parity**:
A **Native Sheet** requirement: the sheet chrome (handle, rounded corners, header) and its footer must visually match the surfaces the Expo DOM WebView paints beneath them. The two are rendered by different engines but read as one continuous surface, so the chrome matches the WebView background and the footer beneath a search bar matches the WebView's muted search surface. The native color tokens therefore track the Web SDK's themed surfaces rather than being chosen independently.
_Avoid_: Theming the sheet chrome on its own; treating the footer as the same color as the rest of the sheet

**Native-Owned State**:
State kept outside the Expo DOM runtime so it can coordinate native wrappers, sheets, and multiple DOM components.
_Avoid_: Shared DOM state, WebView state

**Native Action**:
A top-level async function prop passed from React Native into an Expo DOM component across the WebView boundary—for committed outcomes (e.g. select version, close sheet), not in-sheet UI toggles.
_Avoid_: Nested action, callback object; bridging DOM-only visibility or animation state

**Picker Selection**:
The committed Bible location chosen from chapter picker content, represented as `book`, `chapter`, and `versionId`.
_Avoid_: Passage id, USFM ref

**Reader Location**:
The last committed Bible location (`book`, `chapter`, `versionId`) a **Native Wrapper** restores on launch for uncontrolled readers. Same shape as **Picker Selection**, but names the persisted snapshot rather than the commit event. Controlled `book` / `chapter` / `versionId` win and are not overwritten by the snapshot. Uncontrolled **BibleCard** persists committed `versionId` in MMKV, separate from this snapshot.
_Avoid_: Reader navigation, passage state

**Picker Press**:
The user action that requests opening chapter picker presentation from the current Bible location. Defaults to opening the built-in **Chapter Picker Sheet**; overridable via `onChapterPickerPress`.
_Avoid_: Picker selection

**Version Picker Press**:
The user action that requests opening version picker presentation from the current Bible version. Defaults to opening the built-in **Version Picker Sheet**; overridable via `onVersionPickerPress`. The payload contains `versionId` and `languageId`. On **BibleCard**, the flow requires `showVersionPicker` (default false, Web SDK parity).
_Avoid_: Picker press (use **Picker Press** for chapter picker)

**Chapter Picker Sheet**:
A **Native Wrapper** that hosts chapter picker content inside a **Native Sheet**, receiving a **Picker Selection** via a native action. Public export usable standalone (e.g., with `BibleTextView`).
_Avoid_: Picker modal, chapter popover

**Version Picker Sheet**:
A **Native Wrapper** that hosts Bible version picker content inside one **Native Sheet**. The native side passes the current `versionId` in and receives a new `versionId` via `onSelect`. In-sheet navigation (version list ↔ language list) is owned by the **Version Picker Shell Layout** — not native.
_Avoid_: Version modal, stacked picker sheets, native language-panel flags

**Version Filter**:
Optional allowlists on core `YouVersionProvider` — `permittedVersionIds`, `excludedVersionIds`, `permittedLanguageTags` — that restrict which Bible versions and languages the web SDK may use. Unset permit list = no restriction; `[]` = permit nothing; exclusion wins; language tags are BCP 47. Native stores and forwards the lists into each Expo DOM web `YouVersionProvider`; it does not re-implement the web usability predicate.
_Avoid_: Per-component filter props; a native `isUsableVersion` helper; renaming to platform-configuration types

**Version Refuse**:
When a persisted or host `versionId` is not permitted, native chrome still passes that id into the WebView and lets the web SDK refuse. Native does not auto-pick another version, silently fall back to the default version id, or rewrite **Reader Location** / Bible Card version MMKV on refuse. First-open defaults when there is no stored or host id are unchanged.
_Avoid_: Silent 3034 swap; rewriting recents or persisted location on refuse; picker-only refuse while text still renders

**Version Picker Shell Layout**:
The Expo DOM wrapper (`bible-version-picker-content.tsx`) for version picker sheet content. It owns the version ↔ language cross-fade, shell height, and keyboard overlap via `visualViewport` (same role as **Chapter Picker Shell Layout** for chapter picker). Web uses Radix popover + `isLanguagesOpen`; mobile duplicates layout outside that **Presentation Shell**. On the language trigger, call `event.preventDefault()` so the Web SDK does not also run `setIsLanguagesOpen`.
_Avoid_: Assuming `BibleVersionPicker.Content` popover layout applies inside **Native Sheet**

**DOM-Owned Sheet UI State**:
UI visibility and animation state that applies only inside one sheet's WebView and must not be lifted to React Native (e.g. language panel open inside **Version Picker Sheet**). A **Native Action** round-trip for such state breaks synchronous CSS transitions on first paint.
_Avoid_: Shared picker UI state on native, `showLanguagePicker` bridge props

**Sheet Reset Key**:
A serializable number the **Version Picker Sheet** passes into its Expo DOM component on each open; incrementing it remounts the Web SDK picker tree to clear scroll, search, and in-sheet panel state.
_Avoid_: Using `openKey` for this (reserve **openKey** for repeat-open while `isOpen` stays true, e.g. footnotes)

**Chapter Picker Shell Layout**:
The Expo DOM wrapper for chapter picker content applies scoped layout CSS so the Web SDK book list (`overflow-y-auto` accordion) grows and the search bar (`section` with muted background) stays at the bottom of the visible sheet. The Web SDK renders list and search as siblings without a flex column wrapper, so this behavior is owned by the Expo DOM component until or unless the Web SDK adds an explicit layout root. Inside the WebView, `visualViewport` updates a `--yv-keyboard-overlap` custom property on the shell and `focusin` scrolls focused search fields into view to complement native sheet keyboard handling.
_Avoid_: Assuming `BibleChapterPicker.Content` supplies a full-height flex context

**Reader Controls**:
The visible controls around reader content, including chapter navigation, version selection, and settings. `showToolbar: false` also hides the built-in **Chapter Picker Sheet** and **Version Picker Sheet**.
_Avoid_: Toolbar when referring to product behavior rather than the Web SDK component name

**Compiled Distribution**:
Published packages ship compiled `build/` (`tsc` preserves `'use dom'`). Dev resolves `src/`; `publishConfig` swaps at `pnpm publish`. See [ADR 0011](docs/adr/0011-compiled-distribution.md).
_Avoid_: Source-only, "a compiled build strips the directive"

**Dependency Boundary**:
`@youversion/platform-react-ui` and `@youversion/platform-react-hooks` are `dependencies`. `react-dom` is a `peerDependency` so web-capable consumers do not get a second React. Native modules stay peers.
_Avoid_: Bundled deps, vendored web SDK

**SDK Attribution Header**:
`x-yvp-sdk: ReactNativeSDK=<version>` on DOM-side API calls. Source builds report `{version}-dev`; published builds report `{version}`. See [ADR 0012](docs/adr/0012-sdk-version-stamp-on-publish.md).
_Avoid_: Treating the `-dev` suffix as a bug to remove; a bare `Dev` sentinel; matching `-dev` to detect the channel; a CI-only rewrite invisible from source

**Highlight Scope**:
The chapter a highlights flow is operating on: `versionId` + `book` + `chapter`. Same shape as the web highlights machine (for reuse) and the same Bible-location triple as **Reader Location** — without a user. Per-user isolation for persistent cache is a separate axis at the storage boundary, not part of this type.
_Avoid_: Folding `userId` into this type; Reader Location (restore snapshot for uncontrolled readers, different purpose); cache key (implementation detail)

**Server Colors**:
The verse→color map for a **Highlight Scope**: `Record<number, string>` where keys are verse numbers and values are 6-char hex colors with no `#`. A _derived_ projection of **Cached Highlights** onto the displayed scope — not something we persist. A verse appears at most once: one color at a time, so a recolor replaces rather than accumulates. Range passage ids expand to one entry per verse and colors are normalized to lowercase during projection. Entries whose version, book, or chapter does not match the scope are ignored, so stale data cannot mispaint.
_Avoid_: Persisting this shape (it destroys passage ids — see **Cached Highlights**); highlight colors (ambiguous with UI state), highlightedVerses (Web SDK render prop; often boolean-keyed)

**Cached Highlights**:
The raw core API shape (`Highlight[]`: `version_id` + `passage_id` + `color`) persisted on native per `userId` + **Highlight Scope**. Passage ids may be verse ranges (`JHN.3.16-18`), so this is the only shape that can feed the web reader's controlled `highlights` prop on a cold start and that supports passage-id-targeted deletes. Reads are synchronous and validated; a valid empty array is a real snapshot (“none”), not a cache miss, and any corrupt or legacy payload reads as a miss. What the reader paints, not raw server truth: a **Queued Write** is folded in, which is what lets an unsent highlight survive a relaunch before anything touches the network. MMKV is written queue first, cache second; mount re-applies the queue over the cache.
_Avoid_: Flattening to **Server Colors** before writing; treating an empty array as a miss; merging unsent writes into it

**Highlights Refresh**:
A GET that updates **Cached Highlights** for the current **Highlight Scope**. Same operation whether triggered by mount, a scope change, the app returning to `active`, or a host calling `refresh`. Overlapping calls coalesce onto one in-flight request. It asks the server again; it does not promise the server returns every highlight the user has elsewhere. The GET mounts only when the app **requested** the `highlights` permission on its auth config — not when a grant is known.
_Avoid_: Revalidation, refetch, sync; treating a refresh as proof of cross-app completeness; gating the fetch on `hasPermission('highlights')`

**Reconcile Entry**:
A write the server has accepted, held in memory until a fetch agrees with it. Without it a read replica one step behind repaints a highlight that was just deleted ("vapor"); the color-aware retirement rule is in [ADR 0013](docs/adr/0013-native-highlights-optimistic-layer.md) and reads like a bug in both directions. In memory only — persisting it would make the drain re-send a write the server already has.
_Avoid_: Highlight Overlay (the separate optimistic layer this replaced — **Cached Highlights** now hold the paint), ownership token / write intent (retired with it; a settling write finds its entries by value)

**Controlled Highlights Latch**:
The **Native Wrapper** always supplying a `highlights` array to its **Expo DOM Component**, never `undefined`. The Web SDK reader decides at first mount whether its highlight slice is controlled, and only the controlled branch makes no network calls, keeps no local store, and exposes no auth surface. So the array's _presence on the mount render_ is the guarantee, and `[]` is a legitimate value meaning "controlled, nothing highlighted". Missing it on that first render is what hands the WebView back the ability to write highlights with the token native gave it; dropping it later only un-paints, because the SDK reads `highlights ?? []` after the latch is set. Both are bugs — the first is unrecoverable and silent, which is why the DOM wrapper coerces a non-array to `[]` rather than trusting the type alone.
_Avoid_: Treating an empty highlights array as "nothing to pass"; a conditional or optional `highlights` prop; "controlled mode" alone (names the Web SDK's state, not our obligation)

**Verse Selection**:
The serializable payload the reader emits on every selection change, cleared selections included (`verses: []`). Carries the **Highlight Scope** triple plus `verses`, per-verse `passageIds`, a localized `reference` for display, and `shareData`. On every platform but web the in-WebView verse action UI is off (`verseActions="none"`). This payload is then the only channel native learns about a selection on, and it is what raises the **Verse Action Sheet**. **Selection Clear Signal** is the only way native dismisses one.
_Avoid_: Verse press, tap event; keying off the payload's location fields when `verses` is empty (a clear from navigation carries the _destination_)

**Selection Clear Signal**:
A serializable counter the **Native Wrapper** increments to clear the reader's current **Verse Selection** from outside the WebView. Mount value is the baseline, so mounting never clears. Same nonce idiom as **Sheet Reset Key** and `openKey`, and for the same reason: an imperative ref handle cannot cross the DOM bridge.
_Avoid_: `ref.clearSelection()`; a boolean "is selected" prop; **Sheet Reset Key** (that remounts a picker tree; this one clears a selection)

**Verse Action Sheet**:
The **Native Sheet** the reader raises over a live **Verse Selection**: the localized reference, the **Verse Action Swatches**, Copy, and Share. It replaces the Web SDK's in-WebView verse action **Presentation Shell** on iOS and Android, matching what Swift and Kotlin present. Alone among our sheets it is **non-modal**. It has no backdrop, because a backdrop intercepts the second verse tap that extends a selection. The cost is that backdrop-tap-to-dismiss does not exist. The compensation is an upward drop shadow on every themed **Native Sheet**. It is internal, not exported: the reader owns it, and a host building its own action UI has **Verse Selection** plus `useHighlights`. Every exit from it increments the **Selection Clear Signal**, so the selection and the sheet cannot disagree about whether one exists. It yields to the sign-in and consent sheets — displacement would close it and clear the selection a **Pending Highlight** is waiting on. See [ADR 0017](docs/adr/0017-native-verse-action-sheet.md).
_Avoid_: Verse popover, verse menu; "tap outside to dismiss" (there is nothing outside to tap); giving another sheet `modal={false}` for looks

**Verse Action Swatches**:
The highlight circles in a **Verse Action Sheet**. A pure function projects them from the current **Verse Selection** and its **Server Colors**. One scrolling tray holds two rows: a _remove_ circle for every palette color present on **any** selected verse, then an _apply_ circle for each of the five palette colors. The ANY rule is ported verbatim from the Web SDK popover, and it matches what Swift and Kotlin filter on. A color covering some but not all of the selection therefore appears in both rows, which is intended: remove clears it, and apply extends it across the whole selection. Colors outside the five-swatch palette are ignored, because the reader cannot paint them either.
_Avoid_: Re-deriving the rule from the sheet's UI; an ALL rule (a color on one verse of three still earns a remove circle); counting colors the palette does not contain

**Highlight Write Outcome**:
What an `apply` or `remove` resolves to: `ok` with the verses that landed, `queued` with the verses parked as **Queued Writes**, `noop` when there was nothing to write, or `error` carrying a `reason` (`not-signed-in` / `auth` / `invalid` / `transient`), a diagnostic `message`, and both `failedVerses` (reverted) and `succeededVerses` (landed — non-empty means a partial batch). The only channel a write failure reports on; the hook's `error` state is for fetches alone, so a failed write can never evict a fetch error that is still true. `queued` is a point-in-time signal at the tap, not a standing state — nothing in the API reports on a **Queued Write** afterwards.
_Avoid_: Branching on `message` (generic outside development builds); routing write failures through the hook's `error`; a separate `partial` status (the two verse arrays already say it); reading `ok` as "saved" and `queued` as a failure (both mean the paint stays)

**Access Token Result**:
What `getAccessToken()` resolves to — the only accessor that can tell a refresh that worked from one that did not. Either `ok` with the `token` and the `userId` that owns it, or `unavailable` with a `reason`. The two reasons are different situations: `signed-out` means there is no session; `refresh-failed` means the session is intact and only the token endpoint is unreachable. Without `{ force: true }`, `ok` may be an unexpired leftover. With `force: true`, `ok` means minted on this call. Non-force callers are single-flight by promise — do not put the join back to a boolean flag; the app foregrounding starts a refresh, and a tap a moment later would read the stale token and 401. The `userId` is read in the same synchronous block as the token; `userInfo` through a render lags it.
_Avoid_: Collapsing `refresh-failed` into `signed-out`; treating an unforced `ok` token as freshly minted; reading the owner from `userInfo` alongside a token from here; a boolean in-flight flag (it cannot join)

**Granted Permissions**:
What the user actually granted at sign-in, read off the OAuth **app redirect** and cached per user. A three-state signal, not a list: `null` = no `granted_permissions` key at all, so nothing was requested and nothing is known; `[]` = requested and **denied**; populated = granted. Requesting a permission (`AuthConfig.permissions`) is a separate thing from being granted it. Values the SDK does not recognize are kept verbatim rather than narrowed to the known permission union.
_Avoid_: Scopes (permissions travel as `requested_permissions[]`, never in `scope`); collapsing `[]` into `null` (it erases "the user said no"); "requested permissions" when you mean the grant

**Data Exchange**:
YouVersion's just-in-time permission grant: a signed-in user grants a permission on the spot through a hosted consent page, without signing out. Mint a short-lived token, run the consent page in an auth session, parse the return, and **merge** the result into **Granted Permissions**. Resolves to a granted / cancel / failure outcome and never throws. The consent page returns to the app's `redirectUri` — the same callback URL sign-in uses, because an app key has exactly one — see [ADR 0015](docs/adr/0015-data-exchange-return-scheme.md).
_Avoid_: Treating the return URL as a separate, SDK-owned thing from the app's OAuth `redirectUri`; replacing the cached grant with what one consent reported; "re-authenticating" (the user never signs out)

**Permission Flow**:
The two-branch journey guarding a highlight `apply`: not signed in → sign-in → re-check → apply (or fall through to consent); signed in without the permission → confirmation → **Data Exchange** → apply on grant. The branch point is a pre-flight **Granted Permissions** read after a token refresh, never a write's 401/403 — a `reason: 'auth'` write is the corrective path for a stale cache and re-prompts exactly once. State is a pure hand-rolled reducer (`permission-flow.ts`); events invalid for the current step are no-ops, which is what stops a late browser return from resurrecting a discarded intent. Guards `apply` only; `remove` passes through. Offline with no grant produces no **Queued Write** — the mint fails and the **Pending Highlight** is discarded.
_Avoid_: Branching on a write failure first (burns a round-trip before every first highlight); re-prompting in a loop; running `remove` through the flow; `xstate` (Swift's equivalent is ~60 lines of view-model state)

**Pending Highlight**:
The in-memory `{ color, verses, scope }` a **Permission Flow** stashes when the user taps a color before they can write, and applies when sign-in or consent succeeds. Lives only inside reducer state — `openAuthSessionAsync` returns to the same live process, so web's `sessionStorage` stash and TTL solve a problem native does not have. Discarded cleanly on every cancel, decline, failure, or scope change. Its `scope` is the passage the intent was formed in and governs it: verse numbers replayed into another chapter would paint text the user never selected, so anything resumed after an await is checked against the scope it was claimed under.
_Avoid_: Persisting it (a **Queued Write** is the persisted thing, and it is a different thing); keeping it across a scope change (the user has left the passage); reading the current **Highlight Scope** at replay time instead of the claimed one; treating a discard as an error

**Queued Write**:
One verse's unsent write, persisted per `userId` + **Highlight Scope**, written before the request goes out. Two sides: `local` is where the user wants the verse (a hex color, or `null` for none) and `server` is where the server had it before the user started editing, kept so a rejected write can be put back exactly — offline, and after a relaunch. Desired state, not an operation: a second tap overwrites `local` rather than appending, `server` survives that overwrite, and an entry whose two sides agree asks for nothing and is dropped. Retired when the server accepts or refuses it, never on a failure to reach it. Wins over disagreeing server truth (`Highlight` carries no id or timestamp). A write superseded before it is sent is dropped rather than sent and overwritten.
_Avoid_: **Pending Highlight** (an in-memory permission-flow intent, discarded rather than persisted); a write log or op journal; "offline write" (a 5xx from a reachable server parks here too)

**Highlight Write Queue**:
The durable store of **Queued Writes** and the drain over them, owned by core's `YouVersionProvider` rather than any one `useHighlights`. Connectivity is a trigger, never a gate. Unbounded — no size cap, no TTL, no attempt budget — with a single drop path: a 401/403 that survives a forced token refresh and one retry. Purged on sign-out. See [ADR 0018](docs/adr/0018-highlight-write-queue.md).
_Avoid_: Offline queue (5xx entries park here too); a per-scope or per-hook queue; gating a drain attempt on the connectivity answer; treating a stuck entry as something the SDK will eventually clean up

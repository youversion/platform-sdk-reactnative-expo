# React Native Expo SDK Composition

This context defines the language for composing React Web SDK Bible experiences into React Native Expo apps. It exists so future work preserves the boundary between Web SDK content, Expo DOM adapters, and native presentation/state.

## Language

**React Web SDK Component**:
A component from `@youversion/platform-react-ui` that owns web-first Bible UI behavior and semantics.
_Avoid_: Web component, upstream component

**Expo DOM Component**:
A `'use dom'` wrapper that renders React Web SDK content inside Expo's DOM/WebView runtime on native.
_Avoid_: WebView component, DOM view

**Native Wrapper**:
A React Native component that owns native-facing API, coordination state, and native presentation around one or more Expo DOM components.
_Avoid_: Container, adapter

**Presentation Shell**:
The platform-specific surface that displays reusable content, such as a Radix Popover on web or a NativeSheet on mobile.
_Avoid_: Modal, popup

**Native Sheet**:
The React Native bottom-sheet presentation shell used for mobile interactions that should not use a web popover.
_Avoid_: Modal

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
The last committed Bible location (`book`, `chapter`, `versionId`) a **Native Wrapper** restores on launch for uncontrolled readers. Same shape as **Picker Selection**, but names the persisted snapshot rather than the commit event.
_Avoid_: Reader navigation, passage state

**Picker Press**:
The user action that requests opening chapter picker presentation from the current Bible location. Defaults to opening the built-in **Chapter Picker Sheet**; overridable via `onChapterPickerPress`.
_Avoid_: Picker selection

**Version Picker Press**:
The user action that requests opening version picker presentation from the current Bible version. Defaults to opening the built-in **Version Picker Sheet**; overridable via `onVersionPickerPress`. The payload contains `versionId` and `languageId`.
_Avoid_: Picker press (use **Picker Press** for chapter picker)

**Chapter Picker Sheet**:
A **Native Wrapper** that hosts chapter picker content inside a **Native Sheet**, receiving a **Picker Selection** via a native action. Public export usable standalone (e.g., with `BibleTextView`).
_Avoid_: Picker modal, chapter popover

**Version Picker Sheet**:
A **Native Wrapper** that hosts Bible version picker content inside one **Native Sheet**. The native side passes the current `versionId` in and receives a new `versionId` via `onSelect`. In-sheet navigation (version list ↔ language list) is owned by the **Version Picker Shell Layout** — not native.
_Avoid_: Version modal, stacked picker sheets, native language-panel flags

**Version Picker Shell Layout**:
The Expo DOM wrapper (`bible-version-picker-content.tsx`) for version picker sheet content. It owns the version ↔ language cross-fade, shell height, and keyboard overlap via `visualViewport` (same role as **Chapter Picker Shell Layout** for chapter picker). Web uses Radix popover + `isLanguagesOpen`; mobile duplicates layout outside that **Presentation Shell**.
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
The visible controls around reader content, including chapter navigation, version selection, and settings.
_Avoid_: Toolbar when referring to product behavior rather than the Web SDK component name

**Compiled Distribution**:
The published package ships a compiled `build/` output (`expo-module build`, plain `tsc` → JS + `.d.ts`), not raw source. `tsc` preserves the `'use dom'` directive and the Expo Metro plugin processes it from compiled files in `node_modules`, so Expo DOM Components work when installed from npm. In-repo dev still resolves TypeScript source directly (`main` → `src/`); `publishConfig` swaps to `build/` at publish time, applied by pnpm (`pnpm publish` and `pnpm pack`) but not by raw `npm publish`. The import surface is sealed to the root entry point via a root-only `exports` map (dev → `src/index.ts`, publish → `build/index.js`), so deep imports into internal files are not part of the API. See ADR 0011 (supersedes the earlier source-only model).
_Avoid_: Source-only, "a compiled build strips the directive"

**SDK Attribution Header**:
The `x-yvp-sdk` header (`ReactNativeSDK=<version>`) the DOM-side provider stamps onto every API call made from inside an **Expo DOM Component**. Builds that run from source report `{version}-dev`; published builds report `{version}`, so YouVersion's data lake separates internal dev-time traffic from partner traffic with `endsWith('-dev')` — the same rule the Web SDK uses. `package.json` is the single version source; only the channel flag (`IS_PUBLISH_BUILD`) is stamped into the compiled `build/` output at publish (`prepublishOnly`). See ADR 0012.
_Avoid_: Treating the `-dev` suffix as a bug to remove; a bare `Dev` sentinel (drops the version line); matching `-dev` to detect the channel (it survives in the compiled ternary's dead branch); a CI-only rewrite invisible from source

**Dependency Boundary**:
`@youversion/platform-react-ui` and `@youversion/platform-react-hooks` are `dependencies` (auto-installed). `react-dom` is a `peerDependency` to prevent duplicate React instances in apps that also target web. Transitive native module requirements (reanimated, gesture-handler, etc.) are listed as `peerDependencies` to protect consumers from missing runtime deps.
_Avoid_: Bundled deps, vendored web SDK

**Highlight Scope**:
The chapter a highlights flow is operating on: `versionId` + `book` + `chapter`. Same shape as the web highlights machine (for reuse) and the same Bible-location triple as **Reader Location** — without a user. Per-user isolation for persistent cache is a separate axis at the storage boundary, not part of this type.
_Avoid_: Folding `userId` into this type; Reader Location (restore snapshot for uncontrolled readers, different purpose); cache key (implementation detail)

**Server Colors**:
The verse→color map for a **Highlight Scope**: `Record<number, string>` where keys are verse numbers and values are 6-char hex colors with no `#`. A _derived_ projection of **Cached Highlights** onto the displayed scope — not something we persist. A verse appears at most once: one color at a time, so a recolor replaces rather than accumulates. Range passage ids expand to one entry per verse and colors are normalized to lowercase during projection.
_Avoid_: Persisting this shape (it destroys passage ids — see **Cached Highlights**); highlight colors (ambiguous with UI state), highlightedVerses (Web SDK render prop; often boolean-keyed)

**Cached Highlights**:
The raw core API shape (`Highlight[]`: `version_id` + `passage_id` + `color`) persisted on native per `userId` + **Highlight Scope**. Passage ids may be verse ranges (`JHN.3.16-18`), so this is the only shape that can feed the web reader's controlled `highlights` prop on a cold start and that supports passage-id-targeted deletes. Reads are synchronous and validated; a valid empty array is a real snapshot (“none”), not a cache miss, and any corrupt or legacy payload reads as a miss. What the reader paints, not raw server truth: a **Queued Write** is folded in, which is what lets an unsent highlight survive a relaunch before anything touches the network.
_Avoid_: Flattening to **Server Colors** before writing; treating an empty array as a miss; merging unsent writes into it

**Highlights Refresh**:
A GET that updates **Cached Highlights** for the current **Highlight Scope**. Same operation whether triggered by mount, a scope change, the app returning to `active`, or a host calling `refresh`. Overlapping calls coalesce onto one in-flight request. It asks the server again; it does not promise the server returns every highlight the user has elsewhere.
_Avoid_: Revalidation, refetch, sync; treating a refresh as proof of cross-app completeness

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
The **Native Sheet** the reader raises over a live **Verse Selection**: the localized reference, the **Verse Action Swatches**, Copy, and Share. It replaces the Web SDK's in-WebView verse action **Presentation Shell** on iOS and Android, matching what Swift and Kotlin present. Alone among our sheets it is **non-modal**. It has no backdrop, because a backdrop intercepts the second verse tap that extends a selection. The cost is that backdrop-tap-to-dismiss does not exist. The compensation is an upward drop shadow on every themed **Native Sheet**. It is internal, not exported: the reader owns it, and a host building its own action UI has **Verse Selection** plus `useHighlights`. See [ADR 0017](docs/adr/0017-native-verse-action-sheet.md).
_Avoid_: Verse popover, verse menu; "tap outside to dismiss" (there is nothing outside to tap); giving another sheet `modal={false}` for looks

**Verse Action Swatches**:
The highlight circles in a **Verse Action Sheet**. A pure function projects them from the current **Verse Selection** and its **Server Colors**. One scrolling tray holds two rows: a _remove_ circle for every palette color present on **any** selected verse, then an _apply_ circle for each of the five palette colors. The ANY rule is ported verbatim from the Web SDK popover, and it matches what Swift and Kotlin filter on. A color covering some but not all of the selection therefore appears in both rows, which is intended: remove clears it, and apply extends it across the whole selection. Colors outside the five-swatch palette are ignored, because the reader cannot paint them either.
_Avoid_: Re-deriving the rule from the sheet's UI; an ALL rule (a color on one verse of three still earns a remove circle); counting colors the palette does not contain

**Highlight Write Outcome**:
What an `apply` or `remove` resolves to: `ok` with the verses that landed, `queued` with the verses parked as **Queued Writes**, `noop` when there was nothing to write, or `error` carrying a `reason` (`not-signed-in` / `auth` / `invalid` / `transient`), a diagnostic `message`, and both `failedVerses` (reverted) and `succeededVerses` (landed — non-empty means a partial batch). The only channel a write failure reports on; the hook's `error` state is for fetches alone, so a failed write can never evict a fetch error that is still true. `queued` is a point-in-time signal at the tap, not a standing state — nothing in the API reports on a **Queued Write** afterwards.
_Avoid_: Branching on `message` (generic outside development builds); routing write failures through the hook's `error`; a separate `partial` status (the two verse arrays already say it); reading `ok` as "saved" and `queued` as a failure (both mean the paint stays)

**Access Token Result**:
What `getAccessToken()` resolves to, and the only thing in the SDK that can tell a refresh that worked from one that did not — `refreshToken` swallows failure by design, so a caller reading the token afterwards cannot. Either `ok` with the `token` and the `userId` that owns it, or `unavailable` with a `reason`. The two reasons are different situations, not degrees of the same one: `signed-out` means there is no session, while `refresh-failed` means the session is intact and only the token endpoint is unreachable — tokens stay in storage and the user stays signed in. Without `{ force: true }`, `ok` is not a freshly minted token — it may be an unexpired leftover no refresh was owed for. With `force: true`, `ok` means the endpoint minted on this call: a force caller joins any in-flight refresh, then mints again, so the token is newer than the 401 that provoked the force. `refresh-failed` includes a force that did not land even if an unexpired leftover remains. The `userId` rides along because it is read in the same synchronous block as the token; `userInfo` read through a render lags it, so a caller guarding on a captured identity that compares against the lagging one passes a check it should have failed.
_Avoid_: Collapsing `refresh-failed` into `signed-out` (it would sign out a user who is merely offline); treating an unforced `ok` token as freshly minted; reading the owner from `userInfo` alongside a token from here

**Granted Permissions**:
What the user actually granted at sign-in, read off the OAuth **app redirect** and cached per user. A three-state signal, not a list: `null` = no `granted_permissions` key at all, so nothing was requested and nothing is known; `[]` = requested and **denied**; populated = granted. Requesting a permission (`AuthConfig.permissions`) is a separate thing from being granted it. Values the SDK does not recognize are kept verbatim rather than narrowed to the known permission union.
_Avoid_: Scopes (permissions travel as `requested_permissions[]`, never in `scope`); collapsing `[]` into `null` (it erases "the user said no"); "requested permissions" when you mean the grant

**Data Exchange**:
YouVersion's just-in-time permission grant: a signed-in user grants a permission on the spot through a hosted consent page, without signing out. Mint a short-lived token, run the consent page in an auth session, parse the return, and **merge** the result into **Granted Permissions**. Resolves to a granted / cancel / failure outcome and never throws. The consent page returns to the app's `redirectUri` — the same callback URL sign-in uses, because an app key has exactly one — see [ADR 0015](docs/adr/0015-data-exchange-return-scheme.md).
_Avoid_: Treating the return URL as a separate, SDK-owned thing from the app's OAuth `redirectUri` (one app key, one callback URL, both flows share it); replacing the cached grant with what one consent reported; "re-authenticating" (the user never signs out)

**Permission Flow**:
The two-branch journey guarding a highlight `apply`: not signed in → sign-in → re-check → apply (or fall through to consent); signed in without the permission → confirmation → **Data Exchange** → apply on grant. The branch point is a pre-flight **Granted Permissions** read after a token refresh, never a write's 401/403 — a `reason: 'auth'` write is the corrective path for a stale cache and re-prompts exactly once. State is a pure hand-rolled reducer (`permission-flow.ts`); events invalid for the current step are no-ops, which is what stops a late browser return from resurrecting a discarded intent. Guards `apply` only; `remove` passes through.
_Avoid_: Branching on a write failure first (burns a round-trip before every first highlight); re-prompting in a loop; running `remove` through the flow; `xstate` (Swift's equivalent is ~60 lines of view-model state)

**Pending Highlight**:
The in-memory `{ color, verses, scope }` a **Permission Flow** stashes when the user taps a color before they can write, and applies when sign-in or consent succeeds. Lives only inside reducer state — `openAuthSessionAsync` returns to the same live process, so web's `sessionStorage` stash and TTL solve a problem native does not have. Discarded cleanly on every cancel, decline, failure, or scope change. Its `scope` is the passage the intent was formed in and governs it: verse numbers replayed into another chapter would paint text the user never selected, so anything resumed after an await is checked against the scope it was claimed under.
_Avoid_: Persisting it (a **Queued Write** is the persisted thing, and it is a different thing); keeping it across a scope change (the user has left the passage); reading the current **Highlight Scope** at replay time instead of the claimed one; treating a discard as an error

**Queued Write**:
One verse's unsent write, persisted per `userId` + **Highlight Scope**, written before the request goes out. Two sides: `local` is where the user wants the verse (a hex color, or `null` for none) and `server` is where the server had it before the user started editing, kept so a rejected write can be put back exactly — offline, and after a relaunch. Desired state, not an operation: a second tap overwrites `local` rather than appending, `server` survives that overwrite, and an entry whose two sides agree asks for nothing and is dropped. Retired when the server accepts or refuses it, never on a failure to reach it.
_Avoid_: **Pending Highlight** (an in-memory permission-flow intent, discarded rather than persisted); a write log or op journal; "offline write" (a 5xx from a reachable server parks here too)

**Highlight Write Queue**:
The durable store of **Queued Writes** and the drain over them, owned by core's `YouVersionProvider` rather than any one `useHighlights` — a write must land after the user has navigated away, and draining needs a token. It runs on provider mount, on a token change, on `AppState` returning to active, on the rising edge of connectivity (`expo-network`), on any successful highlights GET, and otherwise on a per-entry backoff that widens on each consecutive failure and resets on success. Connectivity is a trigger, never a gate — the drain never asks whether the network is up before attempting. Unbounded by design — no size cap, no TTL, no attempt budget — with a single drop path, a 401/403 that survives a forced token refresh and one retry. Purged on sign-out with the rest of the user's data. See [ADR 0018](docs/adr/0018-highlight-write-queue.md).
_Avoid_: Offline queue (5xx entries park here too); a per-scope or per-hook queue; gating a drain attempt on the connectivity answer; treating a stuck entry as something the SDK will eventually clean up

## Relationships

- A **React Web SDK Component** may expose reusable content that can be rendered by an **Expo DOM Component**.
- An **Expo DOM Component** sets up its own Web SDK provider because native provider context does not cross into the DOM runtime.
- A **Native Wrapper** passes serializable props down to an **Expo DOM Component** and receives user events through **Native Actions**.
- A **Presentation Shell** is platform-owned; web uses Radix surfaces while native uses a **Native Sheet**.
- **Inactive Sheet Inertness** constrains the normal **Native Sheet** pre-warming model: pre-warmed sheet content must not make inactive sheets visible or usable.
- Closing a **Native Sheet** dismisses any soft keyboard raised by its content, including a keyboard raised by an input inside an **Expo DOM Component**.
- **Native-Owned State** coordinates interactions between reader content and sheet content because DOM runtimes do not share state with native or each other.
- A **Picker Press** opens picker presentation; a **Picker Selection** commits a Bible location and may update **Reader Location** when the reader is uncontrolled.
- **Reader Location** is **Native-Owned State** persisted across app launches (MMKV); controlled `book` / `chapter` / `versionId` props remain the source of truth and are not overwritten by stored **Reader Location**.
- Uncontrolled **BibleCard** persists committed `versionId` across app launches (MMKV, separate from **Reader Location**). Controlled `versionId` + `onVersionChange` remain the source of truth.
- A **Version Picker Press** opens version picker presentation; the sheet commits a new `versionId` via `onSelect`. On **BibleCard**, the flow requires `showVersionPicker` (default false, Web SDK parity).
- **Reader Controls** trigger a **Picker Press** or **Version Picker Press**, which by default opens the built-in **Chapter Picker Sheet** or **Version Picker Sheet** respectively.
- A **Chapter Picker Sheet** receives a **Picker Selection** via a native action and feeds it back to the **Native Wrapper** that owns reader state.
- A **Version Picker Sheet** receives a new `versionId` via `onSelect` and feeds it back to the **Native Wrapper** that owns reader or card state.
- **Version Picker Sheet** passes **Sheet Reset Key** and commit **Native Actions** into **Version Picker Shell Layout**; it does not pass **DOM-Owned Sheet UI State** (e.g. language panel visibility).
- **DOM-Owned Sheet UI State** lives only inside the sheet's Expo DOM component; **Native-Owned State** covers sheet open/close and committed picker outcomes.
- Disabling **Reader Controls** (`showToolbar: false`) also hides the built-in **Chapter Picker Sheet** and **Version Picker Sheet**.
- **Compiled Distribution** ships `build/` to npm (via `expo-module-scripts`); `tsc` preserves `'use dom'` and the Expo Metro plugin processes it from compiled files in `node_modules`, so DOM Components work without shipping raw source.
- The **Dependency Boundary** auto-installs web SDK packages but requires `react-dom` as a peer dep to avoid duplicate React instances when consumers also build for web.
- The **SDK Attribution Header** depends on **Compiled Distribution**: because published builds run from `build/` while dev runs from `src/`, the publish-time stamp can give the two different channel signals from one source file.
- A **Highlight Scope** identifies the chapter for highlights (web-compatible location triple). Native persists **Cached Highlights** keyed by `userId` + **Highlight Scope**; without a known `userId`, the cache does not read or write. This is **Native-Owned State**, distinct from **Reader Location**.
- **Server Colors** are derived from **Cached Highlights** for a given **Highlight Scope**, never stored: entries whose version, book, or chapter does not match the scope are ignored, so stale data cannot mispaint.
- **Cached Highlights** are the only optimistic layer in the stack — the web reader's controlled `highlights` prop is pure projection. A settling write only touches **Queued Writes** still asking for what it sent, so a rejection cannot revert a newer tap.
- A **Highlights Refresh** replaces **Cached Highlights** from the network for one **Highlight Scope**, then folds **Queued Writes** back in so unsent paint survives the round-trip. Returning to `active` triggers it automatically inside the highlights subscription. Hosts that keep a custom surface mounted may call `refresh` when their screen is shown again — the SDK does not take a navigation library as a dependency to detect focus.
- A **Highlight Write Outcome** is the sole report of a write's fate, and is where C3's sign-in branch reads from.
- The reader's **Native Wrapper** derives **Cached Highlights** for its current **Highlight Scope** and holds the **Controlled Highlights Latch** with them; the **Expo DOM Component** only projects that array and never fetches, stores, or authenticates for highlights.
- The highlights fetch is mounted only when the app **requested** the `highlights` permission on its auth config — not when a grant is known. A never-requested permission means no request; an unknown grant still fetches, because absence of a grant record is not a denial.
- With the in-WebView verse action **Presentation Shell** switched off, a **Verse Selection** crosses to native as a **Native Action** and a **Selection Clear Signal** crosses back. Neither is **DOM-Owned Sheet UI State**: the selection is a committed observation, and the clear is a one-way native→DOM command.
- **Granted Permissions** are read only from the app redirect, never from the `/auth/callback` hop, which drops them. They are **Native-Owned State** cached per user in MMKV and purged with the rest of auth state on sign-out; a stale grant can be invalidated so the next pre-flight re-prompts.
- A permission pre-flight reads **Granted Permissions**; a **Highlight Write Outcome** of `reason: 'auth'` is the corrective path when that cache is wrong, not the primary signal.
- Every request that spends a token sources it from an **Access Token Result**, so an expired one is caught before it goes out. An `unavailable` result therefore settles the caller without a round-trip: a write becomes a `transient` **Highlight Write Outcome** and **Data Exchange** a `transient` failure, neither of which touches **Granted Permissions**. Letting the request 401 instead would classify as `auth`, and a **Permission Flow** reads that as a stale grant and drops one that was valid.
- **Data Exchange** is the other way to obtain **Granted Permissions** — the one that does not require a new sign-in. It writes into the same per-user cache, merging rather than replacing, and only ever on a granted return.
- A **Permission Flow** composes the permission pre-flight, sign-in, and **Data Exchange** around a single guarded `apply`; its consent confirmation is a **Native Sheet**, whose every dismissal path routes to decline.
- A **Verse Action Sheet** is open exactly while a **Verse Selection** is live and no permission prompt is up. Every exit from it increments the **Selection Clear Signal**, so the selection and the sheet cannot disagree about whether one exists.
- The **Verse Action Sheet** yields to the sign-in and consent sheets rather than competing with them. **Native Sheet** displacement would close it, and closing it clears the selection a **Pending Highlight** is waiting on.
- **Verse Action Swatches** are a projection of **Verse Selection** over **Server Colors**, the same layer the reader paints from, so the tray and the passage can never disagree. A swatch press routes to **Permission Flow**'s guarded `apply`, or straight to `remove`.
- A **Pending Highlight** belongs to exactly one **Permission Flow** and one **Highlight Scope**; when the flow ends in an apply, its fate is reported through the ordinary **Highlight Write Outcome**.
- A write that fails to reach the server becomes a **Queued Write** instead of reverting; a write rejected by the server (401/403, or any other 4xx) reverts and reports as before, so auth never enters the **Highlight Write Queue**.
- A **Queued Write** survives a cold start because **Cached Highlights** already carry it. MMKV is written queue first, cache second, and the mount re-applies the queue over the cache to repair a process that died between the two.
- The **Highlight Write Queue** needs a way to tell mounted readers an entry was dropped, or a verse stays painted after the SDK has given up on it. A successful drain needs no notification to look right — the paint and the new server truth are the same color.
- A **Queued Write** wins over disagreeing server truth (`Highlight` carries no id or timestamp, so recency cannot be computed).
- A verse holds **one color at a time**, so an apply is an upsert and a color the user has replaced is not a state the server ever needs to see. A **Queued Write** superseded before it is sent is dropped rather than sent and overwritten.
- A **Permission Flow** that cannot complete offline produces no **Queued Write**: the data-exchange mint fails before any browser opens, and the **Pending Highlight** is discarded. Offline highlighting works at all only because the pre-flight reads the _cached_ grant ([ADR 0014](docs/adr/0014-cached-grant-is-a-hint.md)).

## Example Dialogue

> **Dev:** "Can the chapter picker return a USFM ref like `GEN.1`?"
> **Domain expert:** "Use **Picker Selection** state instead: `book`, `chapter`, and `versionId`. The reader already builds its reference from that state."

> **Dev:** "Should the Web SDK popover be reused on mobile?"
> **Domain expert:** "No. Reuse the React Web SDK content, but replace the **Presentation Shell** with a **Chapter Picker Sheet** wrapped in a **Native Sheet**."

> **Dev:** "I don't want the built-in chapter picker sheet. Can I render my own?"
> **Domain expert:** "Pass `onChapterPickerPress` to `BibleReader`. The built-in **Chapter Picker Sheet** is suppressed, and your callback receives the current **Picker Press** data."

> **Dev:** "I want to show my own version picker UI when the user taps the version button in BibleCard."
> **Domain expert:** "Pass `onVersionPickerPress` to `BibleCard`. The built-in **Version Picker Sheet** is suppressed, and your callback receives a **Version Picker Press** with `{ versionId, languageId }`."

> **Dev:** "Should `showLanguagePicker` live on the native sheet so both panels stay in sync?"
> **Domain expert:** "No — that's **DOM-Owned Sheet UI State**. Bridging it as a **Native Action** makes the first language open flash instead of cross-fading. Keep panel visibility in **Version Picker Shell Layout**; native only owns open/close, **Sheet Reset Key**, and committed `versionId`."

> **Dev:** "Tapping outside the verse action sheet doesn't close it. Can we add a backdrop?"
> **Domain expert:** "No. The **Verse Action Sheet** is non-modal on purpose. A backdrop takes the second verse tap, and adding verses to a selection is the point. Swipe down, deselect, or act on the sheet."

> **Dev:** "I wired `onClick` on `BibleVersionPickerLanguageTrigger` but the popover state still changes."
> **Domain expert:** "Call `event.preventDefault()` in the DOM wrapper so the Web SDK doesn't also run `setIsLanguagesOpen`. Mobile uses the shell cross-fade, not popover layout."

> **Dev:** "The user tapped a color offline — can I just persist the pending highlight until they reconnect?"
> **Domain expert:** "Those are two different things. A **Pending Highlight** is an intent waiting on a _permission_, and it stays in memory (ADR 0016). A **Queued Write** is a write waiting on the _network_, and it is persisted. Offline with no grant, the flow fails and nothing is queued — there is no reason to believe that write is permitted."

> **Dev:** "Should we add a connectivity library so the queue drains the moment service comes back?"
> **Domain expert:** "We did — `expo-network`, on the rising edge only. Without it the wait is a foreground away, because the successful-GET signal can't fire on a network that's down, and the backoff that makes a stuck entry cheap is what makes that wait long. But it's a trigger, not a gate: we never ask whether the network is up before attempting, so a wrong answer costs a late attempt, never a skipped one."

## Flagged Ambiguities

- "DOM component" can mean browser UI in general or an Expo DOM wrapper. Resolved: use **Expo DOM Component** for files with `'use dom'` in this SDK.
- "Selection" and "press" are distinct. Resolved: **Picker Press** opens presentation from the current location; **Picker Selection** commits a new location.
- "Passage id", "USFM ref", and reader state were used interchangeably. Resolved: the chapter picker selection payload is reader state: `book`, `chapter`, and `versionId`.
- "**Native-Owned State**" was read as "all picker state on native." Resolved: committed outcomes and sheet coordination are native-owned; in-sheet panels are **DOM-Owned Sheet UI State** (see ADR 0005).
- "Offline queue" (used in [ADR 0013](docs/adr/0013-native-highlights-optimistic-layer.md) and earlier drafts of this file) suggested the queue holds writes made without a network. Resolved: it is the **Highlight Write Queue**, and a 5xx from a perfectly reachable server parks in it too. "Offline" names one cause, not the eligibility rule.
- "Pending" was used for both a permission-flow intent and an unsent write. Resolved: **Pending Highlight** is in-memory and waits on a permission; a **Queued Write** is persisted and waits on the server.

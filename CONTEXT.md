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
The verse→color map for a **Highlight Scope**: `Record<number, string>` where keys are verse numbers and values are 6-char hex colors with no `#`. A _derived_ projection of **Cached Highlights** onto the displayed scope, used for optimistic overlay math — not something we persist, and not optimistic UI overlays themselves. Range passage ids expand to one entry per verse and colors are normalized to lowercase during projection.
_Avoid_: Persisting this shape (it destroys passage ids — see **Cached Highlights**); highlight colors (ambiguous with UI state), highlightedVerses (Web SDK render prop; often boolean-keyed)

**Cached Highlights**:
The raw core API shape (`Highlight[]`: `version_id` + `passage_id` + `color`) persisted on native per `userId` + **Highlight Scope**. Passage ids may be verse ranges (`JHN.3.16-18`), so this is the only shape that can feed the web reader's controlled `highlights` prop on a cold start and that supports passage-id-targeted deletes. Reads are synchronous and validated; a valid empty array is a real snapshot (“none”), not a cache miss, and any corrupt or legacy payload reads as a miss.
_Avoid_: Flattening to **Server Colors** before writing; treating an empty array as a miss

**Highlight Overlay**:
The local layer of pending edits for a **Highlight Scope**, `Record<number, string | null>` — a hex color where the user just applied one, `null` where they just removed one. Sits on top of **Server Colors** so the reader paints before the server answers; entries retire once the server confirms them (see [ADR 0013](docs/adr/0013-native-highlights-optimistic-layer.md) for the color-aware remove rule). Never persisted — see **Cached Highlights**.
_Avoid_: Optimistic state (too vague — this is one specific layer), **Server Colors** (the layer underneath), persisting it

**Controlled Highlights Latch**:
The **Native Wrapper** always supplying a `highlights` array to its **Expo DOM Component**, never `undefined`. The Web SDK reader decides at first mount whether its highlight slice is controlled, and only the controlled branch makes no network calls, keeps no local store, and exposes no auth surface. So the array's _presence_ is the guarantee, and `[]` is a legitimate value meaning "controlled, nothing highlighted" — dropping the prop for even one render hands the WebView back the ability to write highlights with the token native gave it.
_Avoid_: Treating an empty highlights array as "nothing to pass"; a conditional or optional `highlights` prop; "controlled mode" alone (names the Web SDK's state, not our obligation)

**Verse Selection**:
The serializable payload the reader emits on every selection change, cleared selections included (`verses: []`). Carries the **Highlight Scope** triple plus `verses`, per-verse `passageIds`, a localized `reference` for display, and `shareData`. With the in-WebView verse action UI switched off (`verseActions="none"`), this is the only channel a host learns about a selection on — and **Selection Clear Signal** is the only way it dismisses one.
_Avoid_: Verse press, tap event; keying off the payload's location fields when `verses` is empty (a clear from navigation carries the _destination_)

**Selection Clear Signal**:
A serializable counter the **Native Wrapper** increments to clear the reader's current **Verse Selection** from outside the WebView. Mount value is the baseline, so mounting never clears. Same nonce idiom as **Sheet Reset Key** and `openKey`, and for the same reason: an imperative ref handle cannot cross the DOM bridge.
_Avoid_: `ref.clearSelection()`; a boolean "is selected" prop; **Sheet Reset Key** (that remounts a picker tree; this one clears a selection)

**Highlight Write Outcome**:
What an `apply` or `remove` resolves to: `ok` with the verses that landed, `noop` when there was nothing to write, or `error` carrying a `reason` (`not-signed-in` / `auth` / `invalid` / `transient`), a diagnostic `message`, and both `failedVerses` (reverted) and `succeededVerses` (landed — non-empty means a partial batch). The only channel a write failure reports on; the hook's `error` state is for fetches alone, so a failed write can never evict a fetch error that is still true.
_Avoid_: Branching on `message` (generic outside development builds); routing write failures through the hook's `error`; a separate `partial` status (the two verse arrays already say it)

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
_Avoid_: Persisting it (that is F1's offline queue, a different thing); keeping it across a scope change (the user has left the passage); reading the current **Highlight Scope** at replay time instead of the claimed one; treating a discard as an error

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
- A **Highlight Overlay** sits on top of **Server Colors** and is the only optimistic layer in the stack — the web reader's controlled `highlights` prop is pure projection. Each write claims the verses it paints, and a settling write only reverts verses it still owns.
- A **Highlight Write Outcome** is the sole report of a write's fate, and is where C3's sign-in branch reads from.
- The reader's **Native Wrapper** derives **Cached Highlights** for its current **Highlight Scope** and holds the **Controlled Highlights Latch** with them; the **Expo DOM Component** only projects that array and never fetches, stores, or authenticates for highlights.
- The highlights fetch is mounted only when the app **requested** the `highlights` permission on its auth config — not when a grant is known. A never-requested permission means no request; an unknown grant still fetches, because absence of a grant record is not a denial.
- With the in-WebView verse action **Presentation Shell** switched off, a **Verse Selection** crosses to native as a **Native Action** and a **Selection Clear Signal** crosses back. Neither is **DOM-Owned Sheet UI State**: the selection is a committed observation, and the clear is a one-way native→DOM command.
- **Granted Permissions** are read only from the app redirect, never from the `/auth/callback` hop, which drops them. They are **Native-Owned State** cached per user in MMKV and purged with the rest of auth state on sign-out; a stale grant can be invalidated so the next pre-flight re-prompts.
- A permission pre-flight reads **Granted Permissions**; a **Highlight Write Outcome** of `reason: 'auth'` is the corrective path when that cache is wrong, not the primary signal.
- **Data Exchange** is the other way to obtain **Granted Permissions** — the one that does not require a new sign-in. It writes into the same per-user cache, merging rather than replacing, and only ever on a granted return.
- A **Permission Flow** composes the permission pre-flight, sign-in, and **Data Exchange** around a single guarded `apply`; its consent confirmation is a **Native Sheet** (pending localization), whose every dismissal path routes to decline.
- A **Pending Highlight** belongs to exactly one **Permission Flow** and one **Highlight Scope**; when the flow ends in an apply, its fate is reported through the ordinary **Highlight Write Outcome**.

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

> **Dev:** "I wired `onClick` on `BibleVersionPickerLanguageTrigger` but the popover state still changes."
> **Domain expert:** "Call `event.preventDefault()` in the DOM wrapper so the Web SDK doesn't also run `setIsLanguagesOpen`. Mobile uses the shell cross-fade, not popover layout."

## Flagged Ambiguities

- "DOM component" can mean browser UI in general or an Expo DOM wrapper. Resolved: use **Expo DOM Component** for files with `'use dom'` in this SDK.
- "Selection" and "press" are distinct. Resolved: **Picker Press** opens presentation from the current location; **Picker Selection** commits a new location.
- "Passage id", "USFM ref", and reader state were used interchangeably. Resolved: the chapter picker selection payload is reader state: `book`, `chapter`, and `versionId`.
- "**Native-Owned State**" was read as "all picker state on native." Resolved: committed outcomes and sheet coordination are native-owned; in-sheet panels are **DOM-Owned Sheet UI State** (see ADR 0005).

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
The published package ships a compiled `build/` output (`expo-module build`, plain `tsc` → JS + `.d.ts`), not raw source. `tsc` preserves the `'use dom'` directive and the Expo Metro plugin processes it from compiled files in `node_modules`, so Expo DOM Components work when installed from npm. In-repo dev still resolves TypeScript source directly (`main` → `src/`); `publishConfig` swaps to `build/` at publish time, applied by pnpm (`pnpm publish` and `pnpm pack`) but not by raw `npm publish`. See ADR 0011 (supersedes the earlier source-only model).
_Avoid_: Source-only, "a compiled build strips the directive"

**SDK Attribution Header**:
The `x-yvp-sdk` header (`ReactNativeSDK=<version>`) the DOM-side provider stamps onto every API call made from inside an **Expo DOM Component**. Its version reads `Dev` for builds that run from source and the real package version for published builds, so YouVersion's data lake separates internal dev-time traffic from partner traffic. The `Dev` → version swap happens by stamping the compiled `build/` output at publish (`prepublishOnly`), not by importing `package.json` (which would erase the `Dev` signal). See ADR 0012.
_Avoid_: Treating `Dev` as a bug to remove; importing the version at runtime; a CI-only rewrite invisible from source

**Dependency Boundary**:
`@youversion/platform-react-ui` and `@youversion/platform-react-hooks` are `dependencies` (auto-installed). `react-dom` is a `peerDependency` to prevent duplicate React instances in apps that also target web. Transitive native module requirements (reanimated, gesture-handler, etc.) are listed as `peerDependencies` to protect consumers from missing runtime deps.
_Avoid_: Bundled deps, vendored web SDK

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
- The **SDK Attribution Header** depends on **Compiled Distribution**: because published builds run from `build/` while dev runs from `src/`, the publish-time stamp can give the two different version signals from one source file.

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

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

**Native-Owned State**:
State kept outside the Expo DOM runtime so it can coordinate native wrappers, sheets, and multiple DOM components.
_Avoid_: Shared DOM state, WebView state

**Native Action**:
A top-level async function prop passed from React Native into an Expo DOM component across the WebView boundary.
_Avoid_: Nested action, callback object

**Picker Selection**:
The committed Bible location chosen from chapter picker content, represented as `book`, `chapter`, and `versionId`.
_Avoid_: Passage id, USFM ref

**Picker Press**:
The user action that requests opening chapter picker presentation from the current Bible location. Defaults to opening the built-in **Chapter Picker Sheet**; overridable via `onChapterPickerPress`.
_Avoid_: Picker selection

**Chapter Picker Sheet**:
A **Native Wrapper** that hosts chapter picker content inside a **Native Sheet**, receiving a **Picker Selection** via a native action. Public export usable standalone (e.g., with `BibleTextView`).
_Avoid_: Picker modal, chapter popover

**Version Picker Sheet**:
A **Native Wrapper** that hosts Bible version picker content inside one **Native Sheet**. It starts on version selection and lets the user switch to language selection inside the same sheet.
_Avoid_: Version modal, stacked picker sheets

**Chapter Picker Shell Layout**:
The Expo DOM wrapper for chapter picker content applies scoped layout CSS so the Web SDK book list (`overflow-y-auto` accordion) grows and the search bar (`section` with muted background) stays at the bottom of the visible sheet. The Web SDK renders list and search as siblings without a flex column wrapper, so this behavior is owned by the Expo DOM component until or unless the Web SDK adds an explicit layout root. Inside the WebView, `visualViewport` updates a `--yv-keyboard-overlap` custom property on the shell and `focusin` scrolls focused search fields into view to complement native sheet keyboard handling.
_Avoid_: Assuming `BibleChapterPicker.Content` supplies a full-height flex context

**Reader Controls**:
The visible controls around reader content, including chapter navigation, version selection, and settings.
_Avoid_: Toolbar when referring to product behavior rather than the Web SDK component name

**Source-Only Distribution**:
The published package ships raw TypeScript (`src/`) without a compile step. Metro resolves `.ts` natively and the Expo Metro plugin processes `'use dom'` directives from source files in `node_modules`. A compiled build would strip the directive, breaking Expo DOM Components. Consumers must use `moduleResolution: bundler` (default in Expo SDK 55+ projects).
_Avoid_: Compiled output, pre-built, dist bundle

**Dependency Boundary**:
`@youversion/platform-react-ui` and `@youversion/platform-react-hooks` are `dependencies` (auto-installed). `react-dom` is a `peerDependency` to prevent duplicate React instances in apps that also target web. Transitive native module requirements (reanimated, gesture-handler, etc.) are listed as `peerDependencies` to protect consumers from missing runtime deps.
_Avoid_: Bundled deps, vendored web SDK

## Relationships

- A **React Web SDK Component** may expose reusable content that can be rendered by an **Expo DOM Component**.
- An **Expo DOM Component** sets up its own Web SDK provider because native provider context does not cross into the DOM runtime.
- A **Native Wrapper** passes serializable props down to an **Expo DOM Component** and receives user events through **Native Actions**.
- A **Presentation Shell** is platform-owned; web uses Radix surfaces while native uses a **Native Sheet**.
- **Native-Owned State** coordinates interactions between reader content and sheet content because DOM runtimes do not share state with native or each other.
- A **Picker Press** opens picker presentation; a **Picker Selection** commits a Bible location.
- **Reader Controls** trigger a **Picker Press**, which by default opens the built-in **Chapter Picker Sheet**.
- A **Chapter Picker Sheet** receives a **Picker Selection** via a native action and feeds it back to the **Native Wrapper** that owns reader state.
- A **Version Picker Sheet** receives version and language state via native actions and feeds version selection back to the **Native Wrapper** that owns reader or card state.
- Disabling **Reader Controls** (`showToolbar: false`) also hides the built-in **Chapter Picker Sheet**.
- **Source-Only Distribution** is required because the Expo Metro plugin processes `'use dom'` from raw source in `node_modules`; compiled output would strip the directive.
- The **Dependency Boundary** auto-installs web SDK packages but requires `react-dom` as a peer dep to avoid duplicate React instances when consumers also build for web.

## Example Dialogue

> **Dev:** "Can the chapter picker return a USFM ref like `GEN.1`?"
> **Domain expert:** "Use **Picker Selection** state instead: `book`, `chapter`, and `versionId`. The reader already builds its reference from that state."

> **Dev:** "Should the Web SDK popover be reused on mobile?"
> **Domain expert:** "No. Reuse the React Web SDK content, but replace the **Presentation Shell** with a **Chapter Picker Sheet** wrapped in a **Native Sheet**."

> **Dev:** "I don't want the built-in chapter picker sheet. Can I render my own?"
> **Domain expert:** "Pass `onChapterPickerPress` to `BibleReader`. The built-in **Chapter Picker Sheet** is suppressed, and your callback receives the current **Picker Press** data."

## Flagged Ambiguities

- "DOM component" can mean browser UI in general or an Expo DOM wrapper. Resolved: use **Expo DOM Component** for files with `'use dom'` in this SDK.
- "Selection" and "press" are distinct. Resolved: **Picker Press** opens presentation from the current location; **Picker Selection** commits a new location.
- "Passage id", "USFM ref", and reader state were used interchangeably. Resolved: the chapter picker selection payload is reader state: `book`, `chapter`, and `versionId`.

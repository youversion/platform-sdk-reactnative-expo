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
The user action that requests opening chapter picker presentation from the current Bible location.
_Avoid_: Picker selection

**Reader Controls**:
The visible controls around reader content, including chapter navigation, version selection, and settings.
_Avoid_: Toolbar when referring to product behavior rather than the Web SDK component name

## Relationships

- A **React Web SDK Component** may expose reusable content that can be rendered by an **Expo DOM Component**.
- An **Expo DOM Component** sets up its own Web SDK provider because native provider context does not cross into the DOM runtime.
- A **Native Wrapper** passes serializable props down to an **Expo DOM Component** and receives user events through **Native Actions**.
- A **Presentation Shell** is platform-owned; web uses Radix surfaces while native uses a **Native Sheet**.
- **Native-Owned State** coordinates interactions between reader content and sheet content because DOM runtimes do not share state with native or each other.
- A **Picker Press** opens picker presentation; a **Picker Selection** commits a Bible location.
- **Reader Controls** may trigger a **Picker Press**, but the selected Bible location is still owned by the **Native Wrapper** when native sheets are involved.

## Example Dialogue

> **Dev:** "Can the chapter picker return a USFM ref like `GEN.1`?"
> **Domain expert:** "Use **Picker Selection** state instead: `book`, `chapter`, and `versionId`. The reader already builds its reference from that state."

> **Dev:** "Should the Web SDK popover be reused on mobile?"
> **Domain expert:** "No. Reuse the React Web SDK content, but replace the **Presentation Shell** with a **Native Sheet**."

## Flagged Ambiguities

- "DOM component" can mean browser UI in general or an Expo DOM wrapper. Resolved: use **Expo DOM Component** for files with `'use dom'` in this SDK.
- "Selection" and "press" are distinct. Resolved: **Picker Press** opens presentation from the current location; **Picker Selection** commits a new location.
- "Passage id", "USFM ref", and reader state were used interchangeably. Resolved: the chapter picker selection payload is reader state: `book`, `chapter`, and `versionId`.

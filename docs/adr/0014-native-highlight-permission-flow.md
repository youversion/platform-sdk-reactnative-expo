# Native highlight permission flow

A highlight tap by a user who isn't signed in, or who hasn't granted `highlights`, holds the tap as a **Pending Highlight** in memory and asks for consent — a bottom sheet for sign-in, a native `Alert` for the just-in-time permission grant. Consent granted replays the held tap; every cancellation exit discards it.

## Context

`useHighlights` (core) classifies a rejected write as `HighlightWriteOutcome.reason === 'auth'`, and ADR 0013 named that the seam the consent flow would attach to. Phase 3 built the auth half in core — `grantedPermissions`, `hasPermission`, and `requestPermission` over a data-exchange browser session. This ADR records the UI half.

The Swift SDK is the reference implementation for these flows and the source of the copy. Its map has three branches off a single colour tap: no auth configured (silent no-op), signed out (one-step: sign in, and the same consent screen can grant `highlights`), and signed in without the grant (two-step: a just-in-time prompt, then a data exchange).

## Decision

### The sign-in prompt is a sheet; the permission prompt is a native alert

Swift is explicit that only the sign-in prompt is a full sheet — the just-in-time permission prompt and both sign-out dialogs are native alerts (title, message, two buttons). We match, because this is a user-facing surface where cross-SDK consistency is the point, and because it is also the cheaper build: `NativeSheet` is the sanctioned shell for the one sheet and already coordinates displacement with the reader's other three, while `Alert` is free. CONTEXT.md's glossary avoids _Modal_, not _Alert_, and the i18n rules already contemplate SDK-set `Alert` strings.

The sheet is `native/sign-in-with-youversion-sheet.tsx`. Its wordmark is a second SVG asset, `native/youversion-platform-logo.tsx`, ported from the React Web SDK's `icons/youversion-platform-logo.tsx` — a genuinely different mark from `BibleAppLogo` (that one is the Bible App's app icon; this is the "YouVersion Platform" wordmark). Its `accessibilityLabel` is **required with no default**, so no hardcoded English label can ship, mirroring the discipline the web component enforces on `aria-label`.

### The Pending Highlight is in-memory; only authorized writes persist

`expo-web-browser` opens a modal browser over a live JS context, so component state survives both the PKCE and the data-exchange sessions. Web's `sessionStorage` stash with a 10-minute TTL exists to survive a full-page redirect — a problem React Native does not have.

Persisting a _pre-auth_ intent would create a worse one: a highlight materialising minutes later with no user action. So the Pending Highlight lives in a ref inside `useReaderHighlights` and dies with the component.

Keep it distinct from a **Pending Operation** (F1's queue): that is a write already authorized and in flight, which _does_ persist. Different lifetimes, different owners, different failure modes.

### Consent is re-gated against the current scope before it writes

The replay does not trust the scope the tap was made in. It re-runs the intent through `isIntentInScope` against the scope on screen _when the browser session returns_, and drops it on a mismatch. A user who navigates to another chapter mid-consent gets nothing painted, not the previous chapter's selection painted into the new one.

### The one-step path resolves through an effect, not at the await point

`signIn()` resolves before React has re-rendered with the new token and the seeded grant, so there is nothing trustworthy to read at the await point. `useReaderHighlights` arms a replay flag and lets an effect decide against settled state — one code path covers success, denial, cancel, and throw.

Leaving the internal `signing-in` phase is what guarantees that effect runs at all. A _cancelled_ sign-in schedules no auth update, so without a phase change nothing would re-render and the Pending Highlight would linger; the effect then sees "still signed out" and discards it. A _successful_ sign-in schedules its auth updates before that phase change, so React batches them into one commit and the effect sees the signed-in state.

The two-step path needs none of this: `requestPermission` hands the grant back as its return value.

### A successful data exchange also force-reloads the chapter

Matching Swift's `ensureHighlightsForChapterLoaded(forceReload: true)`. The account may already hold highlights for this chapter that we were never permitted to read, and they should appear alongside the one just applied. The reload fires even when the replayed tap is dropped as out of scope — the grant is real regardless.

### The data-exchange session lives in `packages/core/src/auth/`

Not under `highlights/`. It mints tokens and opens auth sessions, reusing `pkce-flow.ts`'s `openAuthSessionAsync` conventions and the app's registered redirect. Highlights merely happens to be its first caller; a future `bible_activity` prompt reuses it unchanged. Putting it under `highlights/` would mean the second permission that needs it has to move it. (Shipped in Phase 3; recorded here because it is half of one decision.)

## Considered alternatives

- **All four surfaces as sheets.** Diverges from the reference on three of them and costs more to build.
- **A new dialog primitive in the native layer.** Unjustifiable for two alerts React Native gives us for free.
- **Persisting the Pending Highlight to MMKV.** Solves a problem this platform does not have and creates a worse one.
- **Reading auth state immediately after `await signIn()`.** The values are stale by construction — React has not committed the sign-in's state updates yet. Doing this would send a user who just signed in successfully down the "cleared, nothing painted" branch.
- **Falling through from a denied sign-in straight into the data exchange.** The design's flow map allows it; we clear instead. Two consecutive consent screens for one tap is a worse first impression than one, and the next tap re-prompts correctly.

## Consequences

- Consent-flow copy uses the canonical Swift keys (`signIn.*`, `dataExchange.*`, `generic.cancel`). Those keys are **not yet in `packages/ui/src/i18n/locales/en.json`**, which is generated and synced from `platform-localization` and must never be hand-edited. Until the sync lands, i18next renders the key string. The code is correct; the data is pending. Whether they land as dotted keys or get renamed to fit React Native's existing flat convention is a question for the localization repo — either way it is a mechanical rename here.
- The wordmark's accessible label has no canonical Swift key (the Swift asset carries no label). It reuses the React Web SDK's existing `youVersionPlatformLogoAriaLabel` rather than coining a new name.
- `appName` in `signIn.paragraph` is derived from `expo-application`'s `applicationName` (`lib/app-name.ts`), not configured. Zero new provider props, correct by default. If Android's app label proves unreliable, that function is the single place an explicit provider prop replaces. It adds `expo-application` to `packages/ui`'s peer dependencies — no new native module for consumers, since core already required it.
- `useReaderHighlights` now owns prompt state as well as write routing. It stays the only place that decides; `native/bible-reader.tsx` presents.
- The permission prompt fires from an effect keyed on the prompt phase alone. Adding the handlers or `t` to its dependency list would re-present the alert on every render.

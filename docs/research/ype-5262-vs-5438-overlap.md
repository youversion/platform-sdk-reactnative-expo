# YPE-5262 vs YPE-5438: do the streams compete?

Read date: 2026-08-31.

This file is research only. It does not implement cache or UI.

## Path note

This repo already has `docs/adr/`, `docs/bug-reports/`, `docs/contributing/`, and `docs/solutions/`. There is no `docs/research/` convention. This file is the first note in that folder.

Sources used:

- Jira issues on lifechurch.atlassian.net, read 2026-08-31
- This repo at `37581827`
- Web SDK types and compiled `BibleTextView` / `BibleCard` / `BibleReader` / `VerseOfTheDay` in `node_modules/@youversion/platform-react-ui`
- `ApiClient` in `node_modules/@youversion/platform-core/src/client.ts`
- Cam's review of YPE-5262 options, plus Cam's 2026-08-31 clarification. Those are labeled **Cam's review**. They are not source code. YPE-5262 has no Jira attachment and one comment ("See how this is done in Swift", Cameron Pak, 2026-08-24).

YPE-5262 still needs a disk cache. That is not in dispute (YPE-5262 AC; Cam's review, 2026-08-31).

## Conclusion

The streams do not both take Bible chapter GET ownership.

1. **YPE-5263 does not compete** with YPE-5262. It is tokens and primitives. Existing Bible screens stay unchanged except DS-8 / DS-9 hex cleanup (YPE-5263).
2. **YPE-5438 as written is native chrome around a DOM `BibleTextView`.** It does not say native will GET chapters, versions, books, or passages, and it does not say `passageState` (YPE-5438, YPE-5440, YPE-5441, YPE-5442, YPE-5447).
3. **A2 is the path that moves eligible Bible GETs onto native** (Cam's review). That is the "RN fetches, then passes data to UI" work.
4. **Cam's collision is not proven by ticket text plus this repo.** 5438 competes with A2 on the same wrapper and bridge files. It does not take the same GET owner unless the team adds option B (paint-only / `passageState` on Reader and Card). Cam's review calls B optional and not required to close 5262.
5. **Do not wait for 5438 to invent a native Bible GET owner.** That seam is not in the 5438 tickets. The pass-to-UI seam for scripture already exists: `passageState` on `BibleTextView` (`packages/ui/src/dom/bible-text-view.tsx`, `BibleTextViewDOM`; Web SDK `BibleTextView` in `@youversion/platform-react-ui`).
6. **Do wait to wire a fetch wrap into `dom/bible-reader.tsx`, `dom/bible-card.tsx`, and `dom/verse-of-the-day.tsx`.** YPE-5448 deletes those full-component wrappers. A wrap there is the roundabout path Cam asked not to take (Cam's review, 2026-08-31; YPE-5448).
7. **A2's native store, header policy, and HTTP client survive 5438 as written.** A Web SDK change used as the RN disk path (passageState implementation in the Web SDK, DOM `fetch` wrap in the Web SDK, TanStack lifetime / YPE-5453) is throwaway for 5262 (YPE-5453; Cam's review, 2026-08-31).

## 1. Current fetch ownership in this repo

No `fetchBibleContent` exists. No `window.fetch` / `globalThis.fetch` wrap exists (`packages/` grep, 2026-08-31).

### Who GETs Bible chapter / version / books / passage

Those GETs run inside each Expo DOM WebView.

| Call | Owner today | Evidence |
| --- | --- | --- |
| Chapter / passage body | Web SDK `usePassage` inside the WebView | Web `BibleTextView` calls `usePassage` unless `passageState` is provided (`node_modules/@youversion/platform-react-ui/dist/index.js`, `hasProvidedPassageState`). Web `BibleReader.Content` calls `usePassage2` (`index.js`). Web `BibleCard` calls `usePassage4` and passes `passageState` into `BibleTextView` (`index.js`). |
| Version file | Web SDK `useVersion` inside the WebView | Web `BibleReader.Content` (`useVersion2`), Web `BibleCard` (`useVersion4`), Web VOTD (`useVersion3`) in `index.js`. |
| Books | Web SDK `useBooks` inside the WebView | Web `BibleReader` root (`useBooks2` at `index.js` ~21238). Chapter picker mounts `BibleChapterPicker.Root` (`packages/ui/src/dom/chapter-picker-content.tsx`, `ChapterPickerContentDOM`). |
| Versions list (`GET /v1/bibles`) | Web SDK `useVersions` inside the version-picker WebView | Web picker (`useVersions` at `index.js` ~18117). This repo mounts `BibleVersionPicker.Root` (`packages/ui/src/dom/bible-version-picker-content.tsx`, `VersionPickerContentDOM`). Cam's review excludes this path from 5262. |
| HTTP | Web SDK `ApiClient` → global `fetch` | `node_modules/@youversion/platform-core/src/client.ts`, `ApiClient.request`. After a 2xx it reads `content-type` and returns the body. It does not return `Cache-Control` (same file). Cam's review states this. |

Each DOM surface mounts its own web `YouVersionProvider` (`packages/ui/src/lib/web-yv-provider.ts`, `YouVersionProvider`; `CONTEXT.md`, **Expo DOM Component**). Native provider context does not cross the WebView (`CONTEXT.md`; `docs/adr/0001-reuse-web-sdk-content-with-native-presentation.md`).

### Surfaces in this repo

**`BibleTextView`**

- Native wrapper: `packages/ui/src/native/bible-text-view.tsx`, `BibleTextView`.
- DOM wrapper: `packages/ui/src/dom/bible-text-view.tsx`, `BibleTextViewDOM`.
- Native owns highlights via `HighlightsPaint` → required `highlights` prop (`native/bible-text-view.tsx`; `packages/ui/src/native/highlights-paint.tsx`, `HighlightsPaint`).
- Native does not construct `passageState`. Grep of `packages/ui/src/native` finds no `passageState`.
- The public native props type still accepts `passageState` because it `Omit`s only `appKey` / `apiHost` / `installationId` / `highlights` from the DOM props (`native/bible-text-view.tsx`).
- DOM forwards `passageState` into the Web SDK and maps `error` with `toWebError` (`dom/bible-text-view.tsx`).
- If `passageState` is omitted, Web `BibleTextView` fetches (`hasProvidedPassageState` / `usePassage` in Web SDK `index.js`).

**`BibleReader`**

- Native wrapper: `packages/ui/src/native/bible-reader.tsx`, `BibleReader`.
- DOM wrapper: `packages/ui/src/dom/bible-reader.tsx`, `BibleReaderDOM`.
- Native owns location (`useReaderLocationStore`), settings, highlights, verse-action sheet, and picker sheet open state (`native/bible-reader.tsx`).
- Native does not GET chapter text. It mounts the full Web `BibleReader.Root` + `Toolbar` + `Content` (`dom/bible-reader.tsx`).
- Web `Content` calls `usePassage` and `useVersion` (`index.js`).

**`BibleCard`**

- Native wrapper: `packages/ui/src/native/bible-card.tsx`, `BibleCard`.
- DOM wrapper: `packages/ui/src/dom/bible-card.tsx`, `BibleCardDOM`.
- Native owns `versionId` (`useControllableState` + `useBibleCardVersionStore`) and highlights (`HighlightsPaint`).
- Native does not GET the passage. It mounts the full Web `BibleCard` (`dom/bible-card.tsx`).
- Web `BibleCard` fetches with `usePassage` / `useVersion` and passes `passageState` into Web `BibleTextView` (`index.js`).

**`VerseOfTheDay`**

- Native wrapper: `packages/ui/src/native/verse-of-the-day.tsx`, `VerseOfTheDay`.
- DOM wrapper: `packages/ui/src/dom/verse-of-the-day.tsx`, `VerseOfTheDayDOM`.
- Native already GETs VOTD `passage_id` via `getVerseOfTheDayPassageId` → `BibleClient.getVOTD` (`packages/ui/src/native/verse-of-the-day-api.ts`; `packages/ui/src/native/use-verse-of-the-day-passage-id.ts`, `useVerseOfTheDayPassageId`).
- That native GET is the daily endpoint, not a chapter/version file. YPE-5453 keeps VOTD off Bible Cache-Control rules.
- Native uses `passage_id` only for `HighlightsPaint` scope (`native/verse-of-the-day.tsx`). It does not pass verse HTML into the WebView.
- The WebView still mounts Web `VerseOfTheDay`, which fetches the verse and version and passes `passageState` into Web `BibleTextView` (`dom/verse-of-the-day.tsx`; Web SDK `index.js`).

**`YouVersionProvider`**

- Native: `packages/ui/src/native/youversion-provider.tsx` wraps core (`packages/core/src/youversion-provider.tsx`). Credentials, auth, version filters, locale, theme, sheets.
- DOM: `packages/ui/src/lib/web-yv-provider.ts` stamps `x-yvp-sdk` via `mergeSdkHeaders`. It does not wrap `fetch`.
- `applySDKConfig` (`packages/ui/src/lib/dom-apply.ts`) writes `appKey` / `apiHost` / `installationId` into `YouVersionPlatformConfiguration`. It does not wrap `fetch`.

**MMKV today**

- Instance id is `yv-platform` (`packages/core/src/storage/constants.ts`, `MMKV_INSTANCE_ID`; `packages/core/src/storage/mmkv-storage.ts`, `mmkvStorage`).
- Used for highlights, highlight queue, installation id, reader location, reader settings, Bible Card version, auth metadata (`CONTEXT.md`; stores under `packages/ui/src/stores/`).
- There is no `yv-bible-content` instance. Cam's review names that id for 5262.

**Highlights**

- Native GET / write / MMKV. Controlled `highlights` always crosses the bridge (`CONTEXT.md`, **Controlled Highlights Latch**; `dom/bible-text-view.tsx`, `dom/bible-reader.tsx`, `dom/bible-card.tsx`, `dom/verse-of-the-day.tsx`).
- This is already "RN fetches, then passes data to UI." 5438 says highlight data is already native-owned and out of scope (YPE-5438, YPE-5440, YPE-5441, YPE-5447).

## 2. Files each stream would touch

### YPE-5262 A1 (Cam's review)

Wrap `fetch` in the DOM realm. Write through to native disk.

Likely files in this repo:

- `packages/ui/src/lib/web-yv-provider.ts` or `packages/ui/src/lib/dom-apply.ts` (one wrap per WebView)
- Every `'use dom'` surface that performs Bible GETs: `dom/bible-text-view.tsx`, `dom/bible-reader.tsx`, `dom/bible-card.tsx`, `dom/verse-of-the-day.tsx`, `dom/chapter-picker-content.tsx`, `dom/bible-version-picker-content.tsx`
- New native disk store + bridge action (Cam's review: bind during render, not `useEffect`)

Cam's review: A1 closes 5262 and is thrown away when Reader is paint-only. Cam's 2026-08-31 clarification: do not treat A1 as the durable path.

### YPE-5262 A2 (Cam's default, Brendan's choice)

Native performs eligible GETs (`GET` under `/v1/bibles/{id}`, including the version file). Exclude `GET /v1/bibles`. WebView wrap calls `fetchBibleContent`. Later, native can pass data into UI.

RN-side files this repo does not have yet:

- Native HTTP client + Cache-Control / Age policy
- MMKV instance `yv-bible-content` (Cam's review)
- Bridge action `fetchBibleContent`, bound during render (Cam's review)

Wrap / pass files (same list as A1 if the first slice is a WebView ask):

- `dom/bible-text-view.tsx` and `native/bible-text-view.tsx` if the ask or `passageState` lives on `BibleTextView`
- `dom/bible-reader.tsx`, `dom/bible-card.tsx`, `dom/verse-of-the-day.tsx` only if the wrap is installed in those full-component WebViews
- Picker DOM files if books / version-file GETs are included before pickers go native

Cam's review: store + client survive a later `passageState` epic. Throwaway is the wrap seam only.

### YPE-5262 B (Cam's review)

A2 plus `passageState` on Reader / Card. Two repos. Not required to close 5262. YPE-5453 also puts "Paint-only Reader / passageState" out of scope.

### YPE-5263 (Dustin, Project A)

Named as tokens, `useTokens`, fonts, `Text` / `Button` / `Card`, sheet/auth hex, lint, ADR 0020 (YPE-5263 subtasks YPE-5264 through YPE-5275).

Explicit: existing Bible screens stay unchanged except DS-8 / DS-9 hex (YPE-5271, YPE-5272). Out of scope: native chrome around DOM scripture, rebuilding `BibleTextView` as native text (YPE-5263).

### YPE-5438 subtasks that name files

| Ticket | Named files |
| --- | --- |
| YPE-5442 | Update `packages/ui/src/dom/bible-text-view.tsx`, `native/bible-text-view.tsx`, `native/__tests__/bible-text-view.test.tsx`. Reference `lib/embed-dom-props.ts`, `web-yv-provider.ts`. Theme + `--yv-reader-*` across the bridge. Not GET. |
| YPE-5440 | Update `native/verse-of-the-day.tsx` and its test. Keep `dom/bible-text-view.tsx`. Replace later: `dom/verse-of-the-day.tsx`. |
| YPE-5441 | Update `native/bible-card.tsx` and card tests. Keep `dom/bible-text-view.tsx`. Replace later: `dom/bible-card.tsx`. |
| YPE-5447 | Update `native/bible-reader.tsx`, `bible-reader-settings-sheet.tsx`, `bible-reader-*.test.tsx`. Keep DOM content via `dom/bible-text-view.tsx`. Mentions `dom/bible-reader.tsx` only as the current content area to replace with `BibleTextView`. |
| YPE-5445 | Update `native/bible-version-picker-sheet.tsx`, `lib/version-picker-panels.ts`. Create `components/bible/version-picker-content.tsx`. Remove later: `dom/bible-version-picker-content.tsx`. |
| YPE-5446 | Update `native/bible-chapter-picker-sheet.tsx`. Create `components/bible/chapter-picker-content.tsx`. Remove later: `dom/chapter-picker-content.tsx`. |
| YPE-5448 | Delete/gate full-component DOM wrappers: `dom/verse-of-the-day.tsx`, `dom/bible-card.tsx`, `dom/bible-reader.tsx` shell, plus picker DOM content. Keep `dom/bible-text-view.tsx` and its bridge helpers. |

YPE-5445 / YPE-5446 do not say "native GET for books or versions." A native picker cannot call Web SDK hooks, so those tickets will need some native catalog read. Versions list is excluded from 5262 (Cam's review; YPE-5453). Books under `/v1/bibles/{id}` is eligible for A2 (Cam's review). Ticket text does not assign that GET to 5262 or 5446.

### Overlap table

| File | A1 | A2 wrap | A2 durable | 5263 | 5438 |
| --- | --- | --- | --- | --- | --- |
| `dom/bible-text-view.tsx` | wrap | wrap or `passageState` | no | no | YPE-5442 theme bridge |
| `native/bible-text-view.tsx` | bridge bind | bridge bind or `passageState` | no | DS-8 only if hex lives here | YPE-5442, YPE-5443 marker tap |
| `lib/web-yv-provider.ts` | likely wrap | maybe | no | no | YPE-5442 reference |
| `lib/embed-dom-props.ts` | no | no | no | no | YPE-5442 reference (sizing, not GET) |
| `dom/bible-reader.tsx` | wrap | wrap if installed here | no | no | deleted by YPE-5448 |
| `native/bible-reader.tsx` | no | only if A2 wires chrome | no | DS-8/9 if hex | YPE-5447 chrome lift |
| `dom/bible-card.tsx` | wrap | wrap if installed here | no | no | deleted by YPE-5448 |
| `native/bible-card.tsx` | no | only if A2 wires chrome | no | DS-8/9 if hex | YPE-5441 chrome lift |
| `dom/verse-of-the-day.tsx` | wrap | wrap if installed here | no | no | deleted by YPE-5448 |
| `native/verse-of-the-day.tsx` | no | only if A2 wires chrome | no | no | YPE-5440 chrome lift |
| Picker DOM content | wrap (books / version file) | wrap if before native pickers | no | no | deleted by YPE-5445/5446/5448 |
| New MMKV `yv-bible-content` + native client | yes | yes | **yes** | no | no |
| Web SDK TanStack / `getWithPolicy` | no | no | no | no | no (YPE-5453, other repo) |

## 3. Verdict per pair

| Pair | Verdict | Evidence |
| --- | --- | --- |
| 5263 vs 5262 | **No semantic conflict** | 5263: tokens / primitives; Bible screens unchanged except hex (YPE-5263). 5262: disk cache for chapter and version files (YPE-5262 AC). No shared GET owner. File overlap is only if DS-8/DS-9 and a cache PR both touch the same hex line. |
| 5438 vs 5262 A1 | **File-merge risk.** Not a GET-ownership fight. | A1 wraps `fetch` in DOM surfaces 5448 will delete (Cam's review; YPE-5448). 5438 still leaves `BibleTextView` fetching unless `passageState` is passed (Web SDK `usePassage`; 5442 does not add `passageState`). |
| 5438 vs 5262 A2 | **File-merge risk** on wrapper / bridge files if A2 wires the wrap there. **No semantic conflict** on Bible GET ownership. | A2 moves eligible GETs to native (Cam's review). 5438 moves chrome to native and keeps scripture DOM (YPE-5438). Hybrid tickets do not say native chapter GET (YPE-5440, YPE-5441, YPE-5447). |
| 5438 vs 5262 B | **Compete** on `BibleTextView` / Reader / Card fetch-then-pass. | B is A2 plus `passageState` on Reader / Card (Cam's review). That is the same "RN fetches, then passes to UI" job. B is not required for 5262 (Cam's review). 5438 tickets do not include B. |

## 4. After hybrid Reader / Card / VOTD, do Bible GETs still happen in the WebView?

**Yes, unless someone passes `passageState`.**

Hybrid tickets say:

- Native chrome wrapping DOM `BibleTextView` (YPE-5440, YPE-5441, YPE-5447)
- `BibleTextView` stays DOM (YPE-5442, YPE-5438)
- Keep `dom/bible-text-view.tsx` (all three)
- Replace later: full-component `dom/verse-of-the-day.tsx`, `dom/bible-card.tsx`, and the `dom/bible-reader.tsx` shell (YPE-5440, YPE-5441, YPE-5448)
- Highlight data stays native (YPE-5438)
- Native already owns `getVOTD` for `passage_id` (this repo, `getVerseOfTheDayPassageId`; YPE-5440 does not add chapter GET)

None of those tickets say:

- Native GET for chapter / version / books / passage
- Pass `passageState`
- Paint-only Reader / Card

Web `BibleTextView` fetches when `passageState` is omitted (`hasProvidedPassageState` in Web SDK `index.js`). This repo's native `BibleTextView` does not pass it.

So A1 / A2 wraps still apply to `BibleTextView` after 5438 as written. They do not need to live on the full-component Reader / Card / VOTD WebViews that 5448 removes.

Native pickers (YPE-5445, YPE-5446) are the one 5438 slice that must stop using Web SDK hooks for books / versions. Ticket text does not assign that GET to 5262.

## 5. What of A2 survives 5438 as written?

5438 as written: chrome native, text still DOM (YPE-5438).

**Survives (RN-side, Cam's review plus this repo):**

- MMKV bible-content store (`yv-bible-content` does not exist yet; today's `yv-platform` is unrelated)
- Header policy (Cache-Control max-age, Age, delete expired, on-screen chapter may stay: YPE-5262 AC; Cam's review)
- Native HTTP client for eligible `GET /v1/bibles/{id}…`
- Feeding `passageState` into `BibleTextView` (prop already forwarded in `dom/bible-text-view.tsx`)

**Throwaway if used as the 5262 path:**

- Web SDK / DOM-client work: TanStack lifetime, `getWithPolicy`, fetch wrap inside `@youversion/platform-react-ui` (YPE-5453 says it does not close 5262, is memory-only, and is per WebView; Cam's review, 2026-08-31)
- A fetch wrap installed in `dom/bible-reader.tsx`, `dom/bible-card.tsx`, `dom/verse-of-the-day.tsx` (YPE-5448 deletes those files)
- A1 as the durable design (Cam's review)

**Not throwaway just because chrome lifts:**

- A wrap or `passageState` bind on `BibleTextView`. 5442 keeps that file. 5448 keeps it.

Cam's earlier worry that "A2 is thrown away if Dustin stops using Expo DOM except `BibleTextView`" overstates the durable A2 pieces. It is true of the wrap seam on the deleted full-component DOM files. It is false of the native store and client (Cam's own A2 note: store + client survive a later `passageState` epic).

## 6. Sequencing

### Can 5262 ship in parallel with 5263?

**Yes.**

5263 does not change Bible GET ownership (YPE-5263). 5262 does not need Project A tokens (YPE-5262). 5263 blocks 5438, not 5262 (YPE-5263 Blocks YPE-5438).

### Should 5262 wait until after a 5438 fetch/pass-to-UI seam exists?

**No.**

5438 as written does not create a native Bible chapter GET owner (YPE-5438, YPE-5440, YPE-5441, YPE-5442, YPE-5447). Waiting for 5438 does not give Brendan a new place to cache.

The pass-to-UI seam for scripture already exists: `passageState` on `BibleTextView` (`dom/bible-text-view.tsx`; Web SDK `BibleTextViewProps.passageState`). Native can fetch on the A2 client and pass that prop. That does not require a Web SDK change.

What should wait:

- Wiring a DOM `fetch` wrap into Reader / Card / VOTD full-component files (those files go away: YPE-5448)
- Treating YPE-5453 (Web TanStack lifetime) as the RN disk implementation (YPE-5453 out of scope: disk, MMKV, closing 5262)

What should not wait:

- Native store, header policy, and HTTP client for 5262 (YPE-5262 AC; Cam's review: those survive)
- Binding that client through `BibleTextView` (`passageState` or a wrap on that one WebView)

If the team later expands 5438 into option B (native GET + `passageState` on Reader / Card), then 5262 should attach to that native owner instead of adding a second client. That expansion is not in the current tickets (Cam's review: B is optional; YPE-5453: paint-only is a later slice).

### Shared seam to agree first

1. **`BibleTextView.passageState`** is the existing paint-only input. Decide that A2 feeds this prop rather than wrapping `fetch` in chrome WebViews (`dom/bible-text-view.tsx`; Web SDK `usePassage` enabled flag).
2. **`latestDomProps` tests** stay the Layer 3 way to assert what native passes into the WebView (`AGENTS.md`; reader / card / VOTD tests under `packages/ui/src/native/__tests__/`).
3. **One web `YouVersionProvider` per WebView.** Do not assume native provider context crosses (`CONTEXT.md`; `web-yv-provider.ts`). A2 bind during render, not `useEffect` (Cam's review).
4. **Do not use YPE-5453 as the RN disk path.** It is in-memory, per provider, other repo, and does not close 5262 (YPE-5453).

## 7. Direct answers to Cam's 2026-08-31 questions

1. **Do A2 and 5438 both end up "RN fetches Bible content, then passes it into UI"?**  
   A2: yes (Cam's review).  
   5438 as written: no for chapter / version / books / passage. Yes only for data native already owns (highlights, VOTD `passage_id`, reader location, card `versionId`). Chrome wrap is not the same as GET wrap.

2. **What of A2 is RN-side and survives? What is Web SDK / DOM-wrap throwaway?**  
   Survives: MMKV `yv-bible-content`, header policy, native HTTP client, `passageState` into `BibleTextView`.  
   Throwaway: Web SDK TanStack / fetch-wrap / 5453-as-RN-path; wrap seams on DOM files 5448 deletes.

3. **Should 5262 wait for the 5438 fetch/pass-to-UI seam?**  
   **No.** That seam is not in 5438. Use `BibleTextView.passageState` now. Stay out of the full-component DOM files 5438 will delete.

4. **5263?**  
   Non-competing. Source matches the hunch (YPE-5263).

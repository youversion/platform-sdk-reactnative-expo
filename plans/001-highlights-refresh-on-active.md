# Plan 001: Highlights Refresh when the app becomes `active`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f5257fc..HEAD -- packages/core/src/highlights/use-highlights.ts packages/core/src/highlights/__tests__/use-highlights.test.tsx CONTEXT.md packages/core/README.md .changeset/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (YPE-4491, simplified)
- **Planned at**: commit `f5257fc`, 2026-08-11

## Why this matters

Mounted `useHighlights` already runs a **Highlights Refresh** on mount and when the **Highlight Scope** (or token) changes. If the partner app stays alive in the background, those triggers never fire — **Cached Highlights** stay stale until the user kills the app or changes chapter.

This plan adds one missing trigger: when React Native reports `AppState` → `active`, call the same `runFetch` path. That matches how auth and the highlight write-queue drain already wake on this branch. It does **not** promise cross-app completeness (a known API gap can still withhold Bible-app highlights); it only asks the server again.

**Deliberately out of this plan:** a `BibleReader` focus/`ref` API for keep-mounted tab returns. See `plans/README.md`.

## Current state

### Files

- `packages/core/src/highlights/use-highlights.ts` — public `useHighlights`; owns `runFetch` / `refresh` / `inFlightRef`. **No `AppState` listener today.**
- `packages/core/src/highlights/highlight-queue-drain-host.tsx` — exemplar AppState wiring (copy this pattern).
- `packages/core/src/highlights/__tests__/use-highlights.test.tsx` — primary test file; already covers mount fetch, scope change, and concurrent `refresh` coalescing.
- `packages/core/src/highlights/__tests__/highlight-queue-drain-host.test.tsx` — exemplar for mocking `AppState.addEventListener`.
- `CONTEXT.md` — may already define **Highlights Refresh** (from prior domain work on this worktree). Confirm and align; do not duplicate.
- `packages/core/README.md` — documents `refresh()` for pull-to-refresh; does not mention AppState.
- `.changeset/native-highlights-release.md` — open minor for the highlights epic (prefer appending one sentence here over a new changeset).

### `runFetch` + mount/scope effect (today)

```415:489:packages/core/src/highlights/use-highlights.ts
  const runFetch = useCallback((): Promise<void> => {
    // ...
    const existing = inFlightRef.current
    if (existing !== null) {
      return existing
    }
    // ... getHighlights → setState(serverUpdated(...)) ...
  }, [api, canFetchHighlights])

  useEffect(() => {
    inFlightRef.current = null
    void runFetch()
  }, [identityKey, accessToken, runFetch])

  const refresh = useCallback((): Promise<void> => runFetch(), [runFetch])
```

### Exemplar AppState listener (copy shape, call `runFetch` instead of `drainNow`)

```56:63:packages/core/src/highlights/highlight-queue-drain-host.tsx
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        drainRef.current?.drainNow()
      }
    })
    return () => subscription.remove()
  }, [])
```

### Domain vocabulary (honor these names in comments/docs)

From `CONTEXT.md`:

- **Highlights Refresh**: A GET that updates **Cached Highlights** for the current **Highlight Scope**. Same operation whether triggered by mount, a scope change, the app returning to `active`, or a host calling `refresh`. Overlapping calls coalesce onto one in-flight request. It asks the server again; it does not promise the server returns every highlight the user has elsewhere.
- **Cached Highlights** / **Highlight Scope** / **Queued Write** — existing terms; a successful refresh still folds queued writes into paint (already implemented inside `runFetch` via `serverUpdated` + `getQueuedWrites`).

### Conventions

- Exact dependency pins; no new packages (`AppState` is from `react-native`, already a peer).
- Conventional commits, e.g. `feat(core): refresh highlights when the app becomes active (YPE-4491)`.
- Tests: Jest + `jest-expo`; prefer `act()` around async; mock patterns already in the two test files above.
- No non-null assertions in source (`x!`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Drift check | `git diff --stat f5257fc..HEAD -- packages/core/src/highlights/use-highlights.ts packages/core/src/highlights/__tests__/use-highlights.test.tsx CONTEXT.md packages/core/README.md .changeset/` | empty, or only expected advisor edits to `CONTEXT.md` |
| Core tests | `pnpm --filter @youversion/platform-react-native-expo-core test -- use-highlights` | all pass |
| Core typecheck | `pnpm --filter @youversion/platform-react-native-expo-core typecheck` | exit 0 |
| Lint touched | `pnpm exec eslint packages/core/src/highlights/use-highlights.ts packages/core/src/highlights/__tests__/use-highlights.test.tsx` | exit 0 |
| Format check (optional) | `pnpm format:check` | exit 0 |

Run package commands from the **repo root** (this worktree).

## Scope

**In scope** (the only files you should modify):

- `packages/core/src/highlights/use-highlights.ts`
- `packages/core/src/highlights/__tests__/use-highlights.test.tsx`
- `CONTEXT.md` (only if **Highlights Refresh** term/relationship is missing or contradicts this plan)
- `packages/core/README.md` (one short note under Highlights)
- `.changeset/native-highlights-release.md` **or** a new `.changeset/*.md` if that file is gone

**Out of scope** (do NOT touch):

- `packages/ui/**` — no `BibleReader` ref/handle, no navigation focus wiring
- `packages/core/src/highlights/highlight-queue-drain-host.tsx` — exemplar only; do not “improve” it
- Connectivity / `expo-network` GET triggers
- Filtering `background → active` vs `inactive → active`
- API / server completeness for Bible-app highlights
- New ADR
- Example app `useFocusEffect` demo (optional follow-up)

## Git workflow

- Branch from current `highlights` (or `advisor/001-highlights-refresh-on-active` if you need isolation).
- Commit style: conventional commits — example from history: `feat(core): highlight writes park offline and reconcile on reconnect (YPE-3717) (#125)`.
- Do NOT push or open a PR unless the operator asked.

## Steps

### Step 0: Drift check

Run the drift command in the Executor instructions. If `use-highlights.ts` already has an `AppState` listener, STOP and report (work may already be done).

**Verify**: drift output reviewed; no unexpected in-scope changes that invalidate excerpts.

### Step 1: Subscribe to `AppState` in `useHighlights`

In `packages/core/src/highlights/use-highlights.ts`:

1. Add import: `import { AppState } from 'react-native'` (keep imports at top of file; no inline imports).
2. After `const refresh = useCallback(...)`, add an effect that mirrors the drain host:

```ts
useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void runFetch()
    }
  })
  return () => subscription.remove()
}, [runFetch])
```

Notes:

- Call `runFetch`, not `refresh` — same function, fewer indirection layers.
- Do **not** clear `inFlightRef` here (unlike the identity/token effect). Clearing would abandon coalescing and start a duplicate GET while one is in flight. Returning to `active` should join an in-flight request via the existing `inFlightRef` guard.
- Do **not** filter on previous `background` vs `inactive`. Fire on `state === 'active'` only.
- Optional one-line comment is fine if it names **Highlights Refresh** and points at the drain-host parity; do not write an essay.

**Verify**: `pnpm exec eslint packages/core/src/highlights/use-highlights.ts` → exit 0.

### Step 2: Tests

In `packages/core/src/highlights/__tests__/use-highlights.test.tsx`:

**2a. AppState → active refreshes**

Model the listener capture after `highlight-queue-drain-host.test.tsx`:

```ts
jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
  appStateListener = listener as (state: AppStateStatus) => void
  return { remove: jest.fn() }
})
```

Add a describe block (e.g. `Highlights Refresh on AppState`) that:

1. Renders `renderUseHighlights()`, waits for the mount GET to settle (`await act(async () => { await Promise.resolve() })` or drain whatever pattern sibling tests use).
2. Clears `mockGetHighlights` mock call history (or records `toHaveBeenCalledTimes` baseline).
3. `act(() => appStateListener?.('background'))` → **no** additional GET.
4. `act(() => appStateListener?.('active'))` → GET called again (same passage scope as mount: `version_id: 111`, `passage_id: 'JHN.3'`).
5. Assert the subscription is removed on unmount (`remove` mock called) — copy the drain-host cleanup spirit if easy; skip if awkward.

Import `AppState` / `AppStateStatus` from `react-native` at the top of the test file.

**2b. Scope-change re-fetch (regression pin)**

Existing tests change chapter but do not clearly assert a second GET for the new passage. Add one focused test under `fetching server truth`:

1. `renderUseHighlights()`, drain mount fetch.
2. `mockGetHighlights.mockClear()`.
3. `rerender({ versionId: 111, book: 'JHN', chapter: '4' })`.
4. Drain the new fetch.
5. Expect `mockGetHighlights` called with `'token-1'` and `{ version_id: 111, passage_id: 'JHN.4' }`.

**Verify**: `pnpm --filter @youversion/platform-react-native-expo-core test -- use-highlights` → all pass, including the new cases.

### Step 3: Docs + domain + changeset

1. **`CONTEXT.md`**: If **Highlights Refresh** is missing, add the definition from “Current state” after **Cached Highlights**, plus a Relationships bullet:

   > A **Highlights Refresh** replaces **Cached Highlights** from the network for one **Highlight Scope**, then folds **Queued Writes** back in so unsent paint survives the round-trip. Returning to `active` triggers it automatically inside the highlights subscription. Hosts that keep a custom surface mounted may call `refresh` when their screen is shown again — the SDK does not take a navigation library as a dependency to detect focus.

   If the term already exists and matches, leave it. If it promises a `BibleReader` convenience API as required, soften to the wording above (host `refresh` only).

2. **`packages/core/README.md`**: In the Highlights section near `refresh` / `isRefreshing`, add one sentence: returning the app to the foreground also runs the same refresh automatically for mounted `useHighlights` subscriptions.

3. **Changeset**: Prefer appending one sentence to `.changeset/native-highlights-release.md` under Reading/writing highlights, e.g. mounted `useHighlights` also refreshes when the app becomes active. If that file is gone, create a new changeset with `pnpm changeset` (patch on `@youversion/platform-react-native-expo-core`) or hand-write a patch markdown matching repo style.

**Verify**: `pnpm --filter @youversion/platform-react-native-expo-core typecheck` → exit 0.

### Step 4: Final gate

**Verify all**:

- `pnpm --filter @youversion/platform-react-native-expo-core test -- use-highlights` → pass
- `pnpm --filter @youversion/platform-react-native-expo-core typecheck` → exit 0
- `git status` → only in-scope files (+ this plan’s README status)
- Update `plans/README.md` status for 001 → DONE

## Test plan

| Case | File | Asserts |
|------|------|---------|
| `active` triggers GET | `use-highlights.test.tsx` | after mount settle, `active` → another `getHighlights` |
| `background` does not | same | no GET on leave |
| Chapter change GET | same | after clear, chapter `4` → `passage_id: 'JHN.4'` |
| Coalescing (existing) | same | `shares one in-flight request between concurrent refresh calls` still passes — AppState must not break `inFlightRef` |

Pattern sources: `highlight-queue-drain-host.test.tsx` (AppState mock), `fetching server truth` describe in `use-highlights.test.tsx` (GET assertions).

## Done criteria

- [ ] `use-highlights.ts` has an `AppState` listener that calls `runFetch()` on `active` without clearing `inFlightRef`
- [ ] New tests cover AppState refresh + chapter-change GET; `pnpm --filter @youversion/platform-react-native-expo-core test -- use-highlights` exits 0
- [ ] `pnpm --filter @youversion/platform-react-native-expo-core typecheck` exits 0
- [ ] `CONTEXT.md` defines **Highlights Refresh** consistently with this plan
- [ ] Core README mentions foreground refresh
- [ ] Changeset updated or added
- [ ] No files outside the in-scope list modified
- [ ] `plans/README.md` status row → DONE

## STOP conditions

Stop and report (do not improvise) if:

- Drift check shows `use-highlights.ts` already implements AppState refresh differently (e.g. `background`-only filter, provider-level refresh of all scopes).
- Adding `AppState` import fails typecheck (unexpected RN types in core) — report; do not add stubs.
- Tests cannot capture the listener because `AppState.addEventListener` is already mocked globally in a conflicting way — fix locally in this file only; if the conflict is in shared jest setup, STOP.
- You believe moment 2 / `BibleReader` handle is required to close YPE-4491 — do not build it here; report so the operator can open a follow-up plan.
- A step’s verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Reviewers: confirm the listener does **not** null `inFlightRef` (identity effect does; this one must not).
- Future: keep-mounted navigation focus needs a reader-level way to call the *same* `runFetch` (BibleReader owns the hook). That is a separate plan / ticket slice.
- YPE-4491 Jira Value/AC should be rewritten to match **Highlights Refresh** (not “Bible-app highlight appears”); API Impediment is not a blocker for *this* SDK work.
- If YPE-4499 (hung fetch blocks later refresh) is still open, AppState will share that pain — do not “fix” coalescing in this plan beyond leaving `inFlightRef` intact.

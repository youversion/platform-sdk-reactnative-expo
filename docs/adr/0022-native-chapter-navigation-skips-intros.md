# 22. Native chapter navigation skips book introductions

Date: 2026-11-05

## Status

Accepted

## Context

The native Reader toolbar navigates numbered chapters. Next from a book's last chapter opens chapter 1 of the next book. Previous from chapter 1 opens the previous book's last numbered chapter. `CONTEXT.md` already defines this behavior.

Shared core 2.17.0 changed `getAdjacentChapter` to visit a book's `intro` before its numbered chapters. Adopting that behavior would change existing native controls as part of an image API dependency upgrade.

## Decision

Preserve native navigation through numbered chapters on iOS and Android. Web reader navigation continues to follow the upstream Web SDK. This is an intentional platform difference.

`adjacentBookChapter` supplies book IDs and numbered chapter IDs to the shared helper, omitting `intro`. The adapter's type assertion depends on the helper reading only those fields. The unchanged tests in `packages/ui/src/lib/__tests__/bible-book-title.test.ts` verify forward and backward book boundaries, intro skipping, and behavior before the catalog loads. Run them after every shared core upgrade.

Before the catalog loads, Previous can step within the current book using the current chapter number. Next requires the chapter catalog and remains disabled.

## Consequences

The image API upgrade preserves existing native navigation. Changing native controls to visit introductions is a separate product change. If the shared helper starts discovering introductions through another field, its upgrade must preserve this contract or replace the adapter.

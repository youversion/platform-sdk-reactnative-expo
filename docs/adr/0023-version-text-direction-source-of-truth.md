# 23. Version text direction is the source of truth for native scripture

Date: 2026-11-06

## Status

Accepted

## Context

The native reader and its footnote sheets must know whether a Bible version reads right to left. The passage HTML carries no `dir` attribute in any sampled Arabic chapter, so the markup gives no answer.

Three sources remain:

- **Language direction.** Unsafe. `ur` is `rtl`, but version 1887 reports `ltr` on its index and version 187 reports `rtl`.
- **A letter vote.** `parsePassage` counts strong letters in the text. It is available at once, but it is a guess. No real chapter has been seen where it is wrong.
- **`text_direction` on `/v1/bibles/{id}/index`.** The only per-version direction source. `/v1/bibles/{id}` and `/books` have no direction field.

The Web SDK resolves an explicit `scriptureDirection`, then YVDOM direction, then HTML `auto`. Its [YPE-4818 ADR](https://github.com/youversion/platform-sdk-react/blob/main/docs/adr/YPE-4818-interface-and-scripture-direction.md) states that direction does not require a metadata request. That order suits a browser, where `dir="auto"` is the last step. Native has no such step, so the order would end in the same letter vote.

## Decision

`text_direction` from the version index is the source of truth. The letter vote is the fallback while the index loads or when it fails. Language direction is not used.

Native deliberately makes the request the Web SDK chose not to make.

`useVersionDirections` sits in `bible-reader.tsx` and `bible-text-view.tsx`, so each surface and its footnote sheet share one result. A host `scriptureDirection` on `BibleTextView` wins and skips the index fetch. The hook keeps a map keyed by version, so a dimmed chapter keeps its own direction during a version switch. A `FootnoteContent` host that passes no `scriptureDirection` gets the vote.

Kotlin's handling is not copied. It reads a version that has not loaded as LTR. The vote avoids that wrong first paint.

## Consequences

Every reader and standalone `BibleTextView` downloads the index once per client and version (deduped across mounts): about 198 KB gzipped (1.6 MB raw), on top of about 193 KB for `/books`. The request goes through the **Bible Content Cache**, so the full body sits in that version's MMKV instance. The response has `max-age=3600`, so the **Content Lifetime** is one hour. This cost protects against cases not yet observed. Replacing `/books` with the index could remove the second download, but the two response shapes have not been compared.

A chapter can paint from the vote and then change direction if the index disagrees. The two have not disagreed on any version checked.

Version 1887 proves on a device that the index beats the language. Its index and its letters agree, so only Jest proves that the index beats the vote.

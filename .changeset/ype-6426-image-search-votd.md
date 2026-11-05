---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Add `useSearch().images` for paged image search, and `useVerseOfTheDay` for the public curated calendar.

A typed `UseSearchResult` stub now needs an `images` key.

Verse of the Day uses `GET /v1/verse-of-the-days` and `GET /v1/verse-of-the-days/{day}`. The shared client validates the day and the language ranges, and it sets a missing `image_id` to `null`.

Both packages depend on `@youversion/platform-core` 2.17.0. The UI package depends on `@youversion/platform-react-ui` 2.17.0. Native Next still skips a book intro and opens chapter 1. Web reader behavior follows that upstream UI package. Update the Developer Hub only after this React Native SDK release is published.

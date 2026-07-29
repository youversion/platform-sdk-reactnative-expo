---
'@youversion/platform-react-native-expo-core': minor
'@youversion/platform-react-native-expo-ui': minor
---

Highlights now revalidate when it matters, so one made on another device shows up.

`useHighlights` re-fetches when the app comes back from the **background**. Only a genuine background → foreground transition triggers it: `expo-web-browser` leaves the app `inactive` during sign-in and the consent flow, and the permission flow already refreshes on its own, so an `inactive` return does not double-fetch.

`BibleReader` gains an imperative handle — `ref.current.refreshHighlights()`, typed as the new exported `BibleReaderHandle` — for the half the SDK cannot detect: navigation focus. Detecting that would mean taking `@react-navigation/native` as a peer dependency and forcing a navigation library on every consumer, so the host calls it from its own focus event instead:

```tsx
const reader = useRef<BibleReaderHandle>(null)
useFocusEffect(
  useCallback(() => {
    void reader.current?.refreshHighlights()
  }, []),
)
return <BibleReader ref={reader} />
```

Both paths are safe to fire freely: they de-dupe against a fetch already in flight, no-op when signed out, and never blank what is already painted. Changing chapter already refetched and still does — the cache does not suppress it.

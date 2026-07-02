---
'@youversion/platform-react-native-expo-ui': patch
---

Refactor `useEffect` anti-patterns per React's "You Might Not Need an Effect" guidance. `BibleCard` and `BibleReader` now persist uncontrolled version/location to their MMKV-backed stores from the `useControllableState` `onChange` handlers (event time) instead of state-mirroring effects, so writes happen only on actual user-driven changes rather than on every render commit including mount. `NativeSheet` resets its Android loader during render via previous-`openKey` comparison instead of in the imperative snap effect, eliminating a one-frame flash of the previous sheet content marked ready on repeated opens. No API changes; one behavioral nuance is that defaults are no longer written to storage on first mount (storage stays empty until the user changes something, with identical fallback UX).

---
'@youversion/platform-react-native-expo-ui': patch
---

Refactor `useEffect` anti-patterns per React's "You Might Not Need an Effect" guidance. `BibleCard` and `BibleReader` now persist uncontrolled version/location to their MMKV-backed stores from the `useControllableState` `onChange` handler instead of a separate state-mirroring effect. `onChange` fires only when the value actually changes, so defaults are no longer written to storage on mount/hydration and there is a single source of persistence rather than a duplicated effect. `NativeSheet` resets its Android loader during render via previous-`openKey` comparison instead of in the imperative snap effect, eliminating a one-frame flash of the previous sheet content marked ready on repeated opens. No API changes; the only behavioral nuance is that storage stays empty until the user changes something (identical fallback UX).

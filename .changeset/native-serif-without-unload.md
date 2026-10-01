---
'@youversion/platform-react-native-expo-ui': patch
---

Untitled Serif from the Fonts API registers on iOS and Android. The bundled Source Serif 4 fallback registers under its own names instead of the Untitled Serif names, because native Expo Font cannot replace a loaded face. When the Fonts API request fails, native serif text uses Source Serif 4, and a later request that succeeds after an `appKey` or `apiHost` change still registers Untitled Serif.

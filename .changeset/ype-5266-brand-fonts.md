---
"@youversion/platform-react-native-expo-core": minor
"@youversion/platform-react-native-expo-ui": minor
---

feat: load Inter, Untitled Serif, and Source Serif 4 from `YouVersionProvider` (YPE-5266)

`YouVersionProvider` registers brand fonts in the background with `expo-font`. Untitled Serif is fetched from the Fonts API (`GET /v1/fonts/1` with `X-YVP-App-Key`). Inter and Source Serif 4 come from Google Font packages. There is no opt-out. Children still render while fonts load. If Untitled Serif cannot load, native serif falls back to Source Serif 4.

## Action required

Install the new `expo-font` peer and rebuild the dev client. A JS-only reload shows `Cannot find native module`.

```bash
npx expo install expo-font
```

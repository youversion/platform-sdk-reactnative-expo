---
'@youversion/platform-react-native-expo-ui': minor
---

feat: name `tokens.radius` by role — `surface` (16, web `rounded-2xl`) and `full` (pill) — and drop the `sm`/`md`/`lg`/`xl`/`2xl` steps ported from web's shadcn calc ramp, which only Button read and which rendered as a pill anyway. Adds the internal `Card` compound primitive on `radius.surface`.

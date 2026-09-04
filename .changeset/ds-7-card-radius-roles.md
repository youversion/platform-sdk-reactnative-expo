---
'@youversion/platform-react-native-expo-ui': minor
---

feat: name `tokens.radius` by role — `surface` (16, web `rounded-2xl`) and `full` (pill) — and drop the `sm`/`md`/`lg`/`xl` steps ported from web's shadcn calc ramp, which only Button read and which rendered as a pill anyway. Adds the internal `Card` compound primitive on `radius.surface`.

## Released as minor, not major

`radius` reaches consumers through the public `getTokens` / `useTokens` / `Tokens`
surface, so dropping the size keys is technically a breaking type change. It ships
as `minor` deliberately: the ramp went public one release ago in 1.5.0, the design
system is still being built out, and no consumer reads `tokens.radius` yet. If you
do, `radius.md` maps to `radius.full`.

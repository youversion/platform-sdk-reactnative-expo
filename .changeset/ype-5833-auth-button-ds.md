---
'@youversion/platform-react-native-expo-ui': patch
---

YouVersionAuthButton now composes the design-system Button for press, radius, and type. Fill and label use `background` / `foreground` for the forced scheme so the Bible App logo stays readable. The locked look is an outlined filled pill; the label can wrap to two lines. `outline`, `radius`, and `size` are no longer public props (YPE-5833 / RNV2-6).

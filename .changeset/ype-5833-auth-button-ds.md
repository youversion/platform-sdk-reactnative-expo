---
'@youversion/platform-react-native-expo-ui': patch
---

YouVersionAuthButton now composes the design-system Button for press, radius, and type. Fill uses the forced scheme `background` so the Bible App logo stays readable; the label color comes from Button. The locked look keeps the pre-Button padding, logo gap, and no default border. The label can wrap to two lines. `outline`, `radius`, and `size` are no longer public props (YPE-5833 / RNV2-6).

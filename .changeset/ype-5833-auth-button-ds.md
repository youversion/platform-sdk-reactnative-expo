---
'@youversion/platform-react-native-expo-ui': patch
---

YouVersionAuthButton now composes the design-system Button `outline` look for press, radius, type, 1px border, and label color. Fill stays the forced scheme `background` so the Bible App logo stays readable in dark. Padding, logo gap, and logo size match the Swift sign-in button (20 / 12, 8px gap, 24px logo). The pill hugs its content. The host places it. The label can wrap to two lines. `outline`, `radius`, and `size` are no longer public props (YPE-5833 / RNV2-6).

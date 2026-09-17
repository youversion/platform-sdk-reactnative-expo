---
'@youversion/platform-react-native-expo-ui': major
'@youversion/platform-react-native-expo-core': major
---

YouVersionAuthButton now composes the design-system Button for press, radius, and type. Fill and label colors are `background` / `foreground` for the forced scheme so the Bible App logo stays readable (Button default `primary` is red in dark). `outline`, `radius`, and `size` (`short` / `icon`) are removed — a breaking public API change on the UI package (YPE-5833 / RNV2-6). Core has no API change; it is listed major only because this repo versions the two packages together.

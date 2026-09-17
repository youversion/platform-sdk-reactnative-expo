---
'@youversion/platform-react-native-expo-ui': major
'@youversion/platform-react-native-expo-core': major
---

YouVersionAuthButton now composes the design-system Button (filled, rounded, full label + Bible App logo child). `background` still forces the light or dark token scheme. `outline`, `radius`, and `size` (`short` / `icon`) are removed — a breaking public API change on the UI package (YPE-5833 / RNV2-6). Core has no API change; it is listed major only because this repo versions the two packages together.

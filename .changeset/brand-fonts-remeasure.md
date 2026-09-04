---
'@youversion/platform-react-native-expo-ui': patch
---

fix: native text draws the system font until the brand faces register, then swaps to Inter so the platform re-measures. Fixes button labels ellipsizing and paragraphs dropping their last line after the first re-render (a theme change, for example), and makes headings bold from the first frame instead of after the next re-render.

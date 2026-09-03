---
'@youversion/platform-react-native-expo-ui': patch
---

fix: derive native sheet chrome from design tokens (YPE-5271). Handle, muted labels, stroke, and shadows now resolve from palette / semantic tokens instead of copied hex. A small shift on the handle and supporting labels is expected where the old hex sat off-palette.

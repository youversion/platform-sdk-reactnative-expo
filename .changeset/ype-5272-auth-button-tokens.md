---
'@youversion/platform-react-native-expo-ui': patch
---

Replace auth-button hex with design tokens (YPE-5272). Border, fill, and label colors resolve from border/background/foreground for the background prop's scheme. Borders and white surfaces stay byte-identical; pure-black values move to #121212.

---
'@youversion/platform-react-native-expo-ui': patch
---

Fix jarring layout jump when the Bible Version and Chapter picker sheets open on Android. The pre-warmed picker WebView sits in an offscreen inert sheet host where Android reports `visualViewport.height` as 0; the keyboard-viewport listener wrote that as `--yv-visible-height: 0px`, collapsing the picker shell (search bar at the top of an empty sheet) until a late viewport resize snapped everything into place mid-animation. Viewport heights below a plausibility floor are now treated as "hidden WebView" and fall back to the stylesheet default (100vh), so the pre-warmed layout is already correct when the sheet opens.

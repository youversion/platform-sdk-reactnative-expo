---
'@youversion/platform-react-native-expo-ui': patch
---

Require React Native Reanimated 4.5.3 or newer to include the upstream fix for
settled animations reverting to their initial position after a delayed React
render. Update the example app to 4.5.3. Consumers must update their compatible
Reanimated dependency and rebuild the native app; a JavaScript-only update is
not sufficient. The configured fixed release group keeps core and UI aligned.

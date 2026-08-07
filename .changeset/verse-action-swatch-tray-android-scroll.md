---
'@youversion/platform-react-native-expo-ui': patch
---

Fix the verse action sheet's highlight swatch tray not scrolling on Android, which made hidden swatches unreachable by touch.

Six swatches fit the tray. A selection spanning two existing highlight colours already produces seven, so this affected a common case, not an edge one — the extra swatches rendered, the trailing fade correctly reported them, and no gesture could reach them.

`@gorhom/bottom-sheet` builds its pan gesture with no activation criteria, so `react-native-gesture-handler` falls back to a direction-agnostic touch slop. A sideways drag over the tray activated the _sheet's_ pan, and activating cancels the touch stream in every native view underneath it, so the tray's `ScrollView` never scrolled. The sheet now constrains that pan to vertical intent, which leaves horizontal drags to the tray. Swipe-down dismissal is unchanged.

`NativeSheet` gains an internal `panActiveOffsetY` pass-through for this. No public API changes.

# Inactive sheet inertness

The default **Native Sheet** model keeps each sheet's Expo DOM content mounted inside its own closed `BottomSheet` host. This pre-warms the WebView and avoids remounting sheet content on first open.

Inactive sheets must still be inert. Before a sheet-opening user action, they must not be visible, draggable, touch-blocking, or otherwise in the user's way. A mounted closed host is acceptable only while it satisfies that product requirement.

Android 12-and-below devices can visibly expose inactive bottom-sheet chrome at the bottom of the screen even when the sheet is initialized closed. Users may see and drag the closed sheet edge before any picker, settings, or footnote interaction asks for it. Safe-area and edge-to-edge geometry may influence where the leaked sheet appears, but the domain problem is broader than bottom padding: an inactive **Native Sheet** is not inert.

The preferred fix preserves WebView pre-warming by keeping inactive **Native Sheet** hosts mounted while disabling native chrome, background, backdrop, gestures, accessibility exposure, and touch participation until the sheet becomes active. Because the confirmed failure appears near the bottom safe area on older tall Android devices, inactive hosts use safe-area bottom geometry and an offscreen container translation to keep their closed host below the visible app and system-nav surface. If a platform cannot satisfy **Inactive Sheet Inertness** with a mounted host, that platform needs a documented exception.

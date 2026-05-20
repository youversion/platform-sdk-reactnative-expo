# Android 12 inactive sheet host suppression

The default **Native Sheet** model keeps each sheet's Expo DOM content mounted inside its own closed `BottomSheet` host. This pre-warms the WebView and avoids remounting sheet content on first open.

Android 12-and-below devices can visibly expose inactive bottom-sheet chrome at the bottom of the screen even when the sheet is initialized closed. Users may see and drag the closed sheet edge before any picker, settings, or footnote interaction asks for it. On that path, the product risk of visible inactive sheet chrome is worse than the first-open latency caused by mounting the WebView on demand.

For Android API 31 and below, inactive **Native Sheet** hosts are suppressed until their sheet becomes active. iOS and newer Android versions keep the documented pre-warmed sheet model. Android WebView version may be the deeper compatibility variable, but React Native API level is the practical signal available in the shared sheet layer.

This is an exception to the pre-warming model, not a new default architecture. Keep normal **Native Sheet** hosts mounted when platform behavior allows it.

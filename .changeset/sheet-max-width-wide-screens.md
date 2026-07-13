---
'@youversion/platform-react-native-expo-ui': patch
---

Cap all Native Sheets (version picker, chapter picker, reader settings, footnotes) at a maximum width of 640, horizontally centered, on wide screens like iPad. Below that breakpoint sheets remain full-width. The cap is applied once in `NativeSheet` via a computed horizontal margin on `@gorhom/bottom-sheet`'s `style` prop, so the whole sheet surface (handle, header, content, footer) is capped while the backdrop still covers the full screen.

# Escape Hatch Pattern for Picker Sheets

> **Status.** The escape hatch still holds. The built-in chapter picker, version picker, and reader settings are native sheets. They are not DOM content.

When the Web SDK fires a picker press event (chapter, version), the native wrapper checks whether the consumer provided the corresponding `onXxxPickerPress` prop. If omitted, the wrapper opens a built-in `NativeSheet` with DOM content. If provided, the wrapper delegates entirely to the consumer and renders no sheet. This gives zero-config defaults while allowing full custom presentation — but means the same component renders differently based on prop presence, which must be documented per-wrapper.

This pattern applies to `onChapterPickerPress` on `BibleReader` and `onVersionPickerPress` on both `BibleReader` and `BibleCard`. Future picker-style interactions should follow the same convention: omit for built-in, provide for custom.

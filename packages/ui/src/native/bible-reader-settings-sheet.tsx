import { useMemo, useRef } from "react";
import { createBibleThemeSettingsContentHandlers } from "@youversion/platform-react-ui";
import BibleReaderSettingsDOM from "../dom/bible-reader-settings";
import { useReaderSettingsStore } from "../stores/reader-settings-store";
import { NativeSheet } from "./native-sheet";
import { useYouVersion } from "./youversion-provider";

export type BibleReaderSettingsSheetProps = {
  isSettingsSheetOpen: boolean;
  onClose: () => void;
};

export function BibleReaderSettingsSheet({
  isSettingsSheetOpen,
  onClose,
}: BibleReaderSettingsSheetProps) {
  const { appKey, theme } = useYouVersion();
  const { setFontFamily, setFontSize, fontSize, fontFamily } = useReaderSettingsStore();

  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;
  const fontFamilyRef = useRef(fontFamily);
  fontFamilyRef.current = fontFamily;

  const { onFontIncreased, onFontDecreased, onFontSelected } = useMemo(
    () =>
      createBibleThemeSettingsContentHandlers({
        getFontSize: () => fontSizeRef.current,
        getFontFamily: () => fontFamilyRef.current,
        setFontSize,
        setFontFamily,
      }),
    [setFontSize, setFontFamily],
  );



  return (
    <NativeSheet isOpen={isSettingsSheetOpen} onClose={onClose}>
      <BibleReaderSettingsDOM
        dom={{ matchContents: true }}
        appKey={appKey}
        theme={theme}
        fontSize={fontSize}
        fontFamily={fontFamily}
        onFontIncreased={onFontIncreased}
        onFontDecreased={onFontDecreased}
        onFontSelected={onFontSelected}
      />
    </NativeSheet>
  );
}

import { useMemo, useRef } from "react";
import { createBibleThemeSettingsContentHandlers } from "@youversion/platform-react-ui";

import BibleReaderSettingsDOM from "../dom/bible-reader-settings";
import type { FontFamily } from "../lib/reader-fonts";
import { useReaderSettings } from "../hooks/use-reader-settings";
import { NativeSheet } from "./native-sheet";
import { useYouVersion } from "./youversion-provider";

export type BibleReaderSettingsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function BibleReaderSettingsSheet({
  isOpen,
  onClose,
}: BibleReaderSettingsSheetProps) {
  const { appKey, theme } = useYouVersion();
  const { fontSize, fontFamily, setFontSize, setFontFamily } =
    useReaderSettings();

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
    <NativeSheet isOpen={isOpen} onClose={onClose}>
      <BibleReaderSettingsDOM
        dom={{ matchContents: true }}
        appKey={appKey}
        theme={theme}
        fontSize={fontSize}
        fontFamily={fontFamily}
        onFontIncreased={async () => {
          onFontIncreased();
        }}
        onFontDecreased={async () => {
          onFontDecreased();
        }}
        onFontSelected={async (newFont: FontFamily) => {
          onFontSelected(newFont);
        }}
      />
    </NativeSheet>
  );
}

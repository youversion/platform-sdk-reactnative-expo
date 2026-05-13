import { useCallback, useMemo, useRef } from "react";
import { createBibleThemeSettingsContentHandlers } from "@youversion/platform-react-ui";

import BibleReaderSettingsDOM from "../dom/bible-reader-settings";
import type { FontFamily } from "../lib/reader-fonts";
import { useReaderSettings } from "../hooks/use-reader-settings";
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

  // Async because Expo DOM function props cross the bridge; useCallback for
  // stable identity so the bridge doesn't re-proxy on every parent render.
  const handleFontIncreased = useCallback(async () => {
    onFontIncreased();
  }, [onFontIncreased]);

  const handleFontDecreased = useCallback(async () => {
    onFontDecreased();
  }, [onFontDecreased]);

  const handleFontSelected = useCallback(
    async (newFont: FontFamily) => {
      onFontSelected(newFont);
    },
    [onFontSelected],
  );

  return (
    <NativeSheet isOpen={isSettingsSheetOpen} onClose={onClose}>
      <BibleReaderSettingsDOM
        dom={{ matchContents: true }}
        appKey={appKey}
        theme={theme}
        fontSize={fontSize}
        fontFamily={fontFamily}
        onFontIncreased={handleFontIncreased}
        onFontDecreased={handleFontDecreased}
        onFontSelected={handleFontSelected}
      />
    </NativeSheet>
  );
}

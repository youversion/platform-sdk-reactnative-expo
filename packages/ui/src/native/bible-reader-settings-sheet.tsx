import { useMemo } from "react";
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

  const { onFontIncreased, onFontDecreased, onFontSelected } = useMemo(
    () =>
      createBibleThemeSettingsContentHandlers({
        getFontSize: () => useReaderSettingsStore.getState().fontSize,
        getFontFamily: () => useReaderSettingsStore.getState().fontFamily,
        setFontSize,
        setFontFamily,
      }),
    [setFontSize, setFontFamily],
  );

  return (
    <NativeSheet isOpen={isSettingsSheetOpen} onClose={onClose} showLoader>
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

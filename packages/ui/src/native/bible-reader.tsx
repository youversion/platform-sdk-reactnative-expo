import { useCallback, useState } from "react";
import { Platform } from "react-native";
import BibleReaderDOM from "../dom/bible-reader";
import type { BibleReaderProps as DomBibleReaderProps } from "../dom/bible-reader";
import FootnoteContent from "../dom/footnote-content";
import type { FootnoteData } from "@youversion/platform-react-ui";
import { useReaderSettingsStore } from "../stores/reader-settings-store";
import { BibleReaderSettingsSheet } from "./bible-reader-settings-sheet";
import { NativeSheet } from "./native-sheet";
import { useYouVersion } from "./youversion-provider";

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: "",
  notes: [],
  verseHtml: "",
};

export type BibleReaderProps = Omit<
  DomBibleReaderProps,
  | "appKey"
  | "fontSize"
  | "fontFamily"
  | "onFontSizeChange"
  | "onFontFamilyChange"
  | "onOpenBibleThemeSettings"
> & {
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onFootnotePress?: (data: FootnoteData) => Promise<void>;
};

export function BibleReader({
  onFootnotePress: consumerOnFootnotePress,
  ...domProps
}: BibleReaderProps) {
  const context = useYouVersion();
  const themeBackground = domProps.themeBackground ?? context.theme;
  const { setFontFamily, setFontSize, fontSize, fontFamily } = useReaderSettingsStore();


  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null);
  // footnoteData can remain non-null across repeated taps, so track each tap as an open event.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);

  const handleOpenBibleThemeSettings = useCallback(() => {
    setIsSettingsSheetOpen(true);
  }, []);

  const onFootnotePress =
    Platform.OS !== "web"
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data);
          setFootnoteOpenKey((key) => key + 1);
        }))
      : undefined;

  const showFootnoteSheet = Platform.OS !== "web" && !consumerOnFootnotePress;

  return (
    <>
      <BibleReaderDOM
        {...domProps}
        appKey={context.appKey}
        themeBackground={themeBackground}
        fontSize={fontSize}
        fontFamily={fontFamily}
        onFontSizeChange={setFontSize}
        onFontFamilyChange={setFontFamily}
        onOpenBibleThemeSettings={
          Platform.OS !== "web" ? handleOpenBibleThemeSettings : undefined
        }
        onFootnotePress={onFootnotePress}
      />
      {Platform.OS !== "web" && (
        <BibleReaderSettingsSheet
          isSettingsSheetOpen={isSettingsSheetOpen}
          onClose={() => setIsSettingsSheetOpen(false)}
        />
      )}
      {showFootnoteSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          openKey={footnoteOpenKey}
          onClose={() => setFootnoteData(null)}
        >
          <FootnoteContent
            dom={{ matchContents: true }}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={themeBackground}
            fontSize={fontSize}
            appKey={context.appKey}
          />
        </NativeSheet>
      )}
    </>
  );
}

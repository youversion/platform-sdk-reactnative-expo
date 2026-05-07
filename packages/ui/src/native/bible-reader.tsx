import { useState } from "react";
import { Platform } from "react-native";
import BibleReaderDOM from "../dom/bible-reader";
import type { BibleReaderProps as DomBibleReaderProps } from "../dom/bible-reader";
import FootnoteContent from "../dom/footnote-content";
import type { FootnoteData } from "@youversion/platform-react-ui";
import { NativeSheet } from "./native-sheet";

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: "",
  notes: [],
  verseHtml: "",
};

export type BibleReaderProps = DomBibleReaderProps & {
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onFootnotePress?: (data: FootnoteData) => Promise<void>;
};

export function BibleReader({
  onFootnotePress: consumerOnFootnotePress,
  ...domProps
}: BibleReaderProps) {
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null);

  const onFootnotePress =
    Platform.OS !== "web"
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data);
        }))
      : undefined;

  const showSheet = Platform.OS !== "web" && !consumerOnFootnotePress;

  return (
    <>
      <BibleReaderDOM {...domProps} onFootnotePress={onFootnotePress} />
      {showSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          onClose={() => setFootnoteData(null)}
        >
          <FootnoteContent
            dom={{ matchContents: true }}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={domProps.themeBackground}
            fontSize={domProps.fontSize}
            appKey={domProps.appKey}
          />
        </NativeSheet>
      )}
    </>
  );
}

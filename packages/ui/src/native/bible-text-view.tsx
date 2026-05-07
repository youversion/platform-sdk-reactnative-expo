import { useState } from "react";
import { Platform, useColorScheme } from "react-native";
import BibleTextViewDOM from "../dom/bible-text-view";
import type { BibleTextViewProps as BibleTextViewDOMProps } from "../dom/bible-text-view";
import FootnoteContent from "../dom/footnote-content";
import type { FootnoteContentDOMProps } from "../dom/footnote-content";
import type { FootnoteData } from "@youversion/platform-react-ui";
import { NativeSheet } from "./native-sheet";

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: "",
  notes: [],
  verseHtml: "",
};

export type BibleTextViewProps = BibleTextViewDOMProps & {
  onFootnotePress?: (data: FootnoteData) => Promise<void>;
};

export function BibleTextView({
  onFootnotePress: consumerOnFootnotePress,
  ...domProps
}: BibleTextViewProps) {
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null);
  const colorScheme = useColorScheme();

  const onFootnotePress =
    Platform.OS !== "web"
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data);
        }))
      : undefined;

  const showSheet = Platform.OS !== "web" && !consumerOnFootnotePress;
  const footnoteTheme: FootnoteContentDOMProps["theme"] =
    domProps.theme === "system"
      ? colorScheme === "dark"
        ? "dark"
        : "light"
      : (domProps.theme ?? "light");

  return (
    <>
      <BibleTextViewDOM {...domProps} onFootnotePress={onFootnotePress} />
      {showSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          onClose={() => setFootnoteData(null)}
        >
          <FootnoteContent
            dom={{ matchContents: true }}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={footnoteTheme}
            fontSize={domProps.fontSize}
            appKey={domProps.appKey}
          />
        </NativeSheet>
      )}
    </>
  );
}

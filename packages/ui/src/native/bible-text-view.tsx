import { useState } from "react";
import { Platform, useColorScheme } from "react-native";
import { resolveTheme } from "../lib/resolve-theme";
import BibleTextViewDOM from "../dom/bible-text-view";
import type { BibleTextViewProps as BibleTextViewDOMProps } from "../dom/bible-text-view";
import FootnoteContent from "../dom/footnote-content";
import type { FootnoteContentDOMProps } from "../dom/footnote-content";
import type { FootnoteData } from "@youversion/platform-react-ui";
import { NativeSheet } from "./native-sheet";
import { useYouVersion } from "./youversion-provider";

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: "",
  notes: [],
  verseHtml: "",
};

export type BibleTextViewProps = Omit<BibleTextViewDOMProps, "appKey"> & {
  onFootnotePress?: (data: FootnoteData) => Promise<void>;
};

export function BibleTextView({
  onFootnotePress: consumerOnFootnotePress,
  ...domProps
}: BibleTextViewProps) {
  const context = useYouVersion();
  const theme = domProps.theme ?? context.theme;
  const colorScheme = useColorScheme();
  const resolvedTheme = resolveTheme(theme, colorScheme);
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null);
  // footnoteData can remain non-null across repeated taps, so track each tap as an open event.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0);

  const onFootnotePress =
    Platform.OS !== "web"
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data);
          setFootnoteOpenKey((key) => key + 1);
        }))
      : undefined;

  const showSheet = Platform.OS !== "web" && !consumerOnFootnotePress;
  const footnoteTheme: FootnoteContentDOMProps["theme"] = resolvedTheme;

  return (
    <>
      <BibleTextViewDOM
        {...domProps}
        appKey={context.appKey}
        theme={theme}
        onFootnotePress={onFootnotePress}
      />
      {showSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          openKey={footnoteOpenKey}
          onClose={() => setFootnoteData(null)}
          showLoader
        >
          <FootnoteContent
            dom={{ matchContents: true }}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={footnoteTheme}
            fontSize={domProps.fontSize}
            appKey={context.appKey}
          />
        </NativeSheet>
      )}
    </>
  );
}

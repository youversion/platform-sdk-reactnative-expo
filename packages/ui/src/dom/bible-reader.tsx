"use dom";

import { YouVersionProvider, BibleReader } from "@youversion/platform-react-ui";
import type { FootnoteData } from "@youversion/platform-react-ui";
import type { StyleProp, ViewStyle } from "react-native";

export type BibleReaderProps = {
  appKey: string;
  defaultVersionId?: number;
  themeBackground?: "light" | "dark";
  onSettingsPress?: () => Promise<void>;
  onFootnotePress?: (data: FootnoteData) => Promise<void>;
  fontSize?: number;
  fontFamily?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  style?: StyleProp<ViewStyle>;
  dom?: import("expo/dom").DOMProps;
};

export default function BibleReaderDOM({
  appKey,
  defaultVersionId = 3034,
  themeBackground = "light",
  onSettingsPress,
  onFootnotePress,
  fontSize,
  fontFamily,
  backgroundColor,
  foregroundColor,
}: BibleReaderProps) {
  const sanitizeCssValue = (value: string | undefined) =>
    value?.replace(/[{};]/g, "").trim();

  return (
    <YouVersionProvider appKey={appKey} theme={themeBackground}>
      <style href="yv-bible-reader-overrides" precedence="medium">
        {`[data-slot="yv-bible-renderer"] {
          ${fontSize ? `--yv-reader-font-size: ${fontSize}px !important;` : ""}
          ${fontFamily ? `--yv-reader-font-family: ${sanitizeCssValue(fontFamily)} !important;` : ""}
          ${backgroundColor ? `--yv-reader-bg: ${sanitizeCssValue(backgroundColor)} !important;` : ""}
          ${foregroundColor ? `--yv-reader-fg: ${sanitizeCssValue(foregroundColor)} !important;` : ""}
        }`}
      </style>
      <div style={{ position: "relative", height: "100%", width: "100%" }}>
        <BibleReader.Root
          defaultVersionId={defaultVersionId}
          onFootnotePress={onFootnotePress}
        >
          <BibleReader.Content />
        </BibleReader.Root>
      </div>
    </YouVersionProvider>
  );
}

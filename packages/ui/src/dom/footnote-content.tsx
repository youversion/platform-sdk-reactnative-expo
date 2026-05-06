"use dom";

import {
  FootnoteContent as WebFootnoteContent,
  YouVersionProvider,
} from "@youversion/platform-react-ui";
import type { FootnoteData } from "@youversion/platform-react-ui";

export type FootnoteContentDOMProps = {
  data: FootnoteData;
  theme?: "light" | "dark";
  fontSize?: number;
  appKey: string;
  dom?: import("expo/dom").DOMProps;
};

export default function FootnoteContentDOM({
  data,
  theme = "light",
  fontSize,
  appKey,
}: FootnoteContentDOMProps) {
  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Disable WebView scroll */}
      <style
        dangerouslySetInnerHTML={{ __html: "html, body { overflow: hidden; }" }}
      />
      <WebFootnoteContent {...data} fontSize={fontSize} theme={theme} />
    </YouVersionProvider>
  );
}

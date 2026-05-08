"use dom";

import {
  BibleTextView,
  YouVersionProvider,
} from "@youversion/platform-react-ui";
import type { FootnoteData } from "@youversion/platform-react-ui";

type WebBibleTextViewProps =
  import("@youversion/platform-react-ui").BibleTextViewProps;
type WebPassageState = NonNullable<WebBibleTextViewProps["passageState"]>;

import { type DomError, toWebError } from "../lib/dom-error";

type DomPassageState = Omit<WebPassageState, "error"> & {
  error?: DomError;
};

export type BibleTextViewProps = Omit<
  WebBibleTextViewProps,
  "onVerseSelect" | "onFootnotePress" | "theme" | "passageState"
> & {
  appKey: string;
  theme?: "light" | "dark" | "system";
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onVerseSelect?: (verses: number[]) => Promise<void>;
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onFootnotePress?: (data: FootnoteData) => Promise<void>;
  passageState?: DomPassageState;
  dom?: import("expo/dom").DOMProps;
};

export default function BibleTextViewDOM({
  appKey,
  theme = "light",
  onVerseSelect,
  onFootnotePress,
  passageState,
  ...props
}: BibleTextViewProps) {
  const webPassageState: WebBibleTextViewProps["passageState"] =
    passageState != null
      ? {
          ...passageState,
          error: toWebError(passageState.error),
        }
      : undefined;

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <BibleTextView
        {...props}
        passageState={webPassageState}
        onVerseSelect={onVerseSelect}
        onFootnotePress={onFootnotePress}
      />
    </YouVersionProvider>
  );
}

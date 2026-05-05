"use dom";

import { BibleCard, YouVersionProvider } from "@youversion/platform-react-ui";

type WebBibleCardProps = import("@youversion/platform-react-ui").BibleCardProps;

export type BibleCardProps = WebBibleCardProps & {
  appKey: string;
  theme?: "light" | "dark" | "system";
  dom?: import("expo/dom").DOMProps;
};

export default function BibleCardDOM({
  appKey,
  theme = "light",
  ...props
}: BibleCardProps) {
  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <BibleCard {...props} />
    </YouVersionProvider>
  );
}

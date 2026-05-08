import BibleCardDOM from "../dom/bible-card";
import type { BibleCardProps as BibleCardDOMProps } from "../dom/bible-card";
import { useYouVersion } from "./youversion-provider";

export type BibleCardProps = Omit<BibleCardDOMProps, "appKey">;

export function BibleCard({ theme, ...props }: BibleCardProps) {
  const context = useYouVersion();

  return (
    <BibleCardDOM
      {...props}
      appKey={context.appKey}
      theme={theme ?? context.theme}
    />
  );
}

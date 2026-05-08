import VerseOfTheDayDOM from "../dom/verse-of-the-day";
import type { VerseOfTheDayProps as VerseOfTheDayDOMProps } from "../dom/verse-of-the-day";
import { useYouVersion } from "./youversion-provider";

export type VerseOfTheDayProps = Omit<VerseOfTheDayDOMProps, "appKey">;

export function VerseOfTheDay({ theme, ...props }: VerseOfTheDayProps) {
  const context = useYouVersion();

  return (
    <VerseOfTheDayDOM
      {...props}
      appKey={context.appKey}
      theme={theme ?? context.theme}
    />
  );
}

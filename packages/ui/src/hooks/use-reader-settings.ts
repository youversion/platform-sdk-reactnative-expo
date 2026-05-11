import { useCallback } from "react";
import { useMMKVNumber, useMMKVString } from "react-native-mmkv";
import {
  BIBLE_READER_FONT,
  clampBibleReaderFontSize,
} from "@youversion/platform-react-ui";

import {
  mmkvStorage,
  READER_FONT_FAMILY_KEY,
  READER_FONT_SIZE_KEY,
} from "../lib/storage";
import { SOURCE_SERIF_FONT, type FontFamily } from "../lib/reader-fonts";

export type ReaderSettings = {
  fontSize: number;
  fontFamily: FontFamily;
  setFontSize: (size: number) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
};

/**
 * Source of truth for Bible reader font preferences on native.
 *
 * Values are reactively persisted to MMKV so settings survive app restarts.
 * Theme is intentionally not part of this hook — it lives on
 * `YouVersionProvider` and any caller that needs it should read it from
 * `useYouVersion()` directly.
 */
export function useReaderSettings(): ReaderSettings {
  const [storedFontSize, setStoredFontSize] = useMMKVNumber(
    READER_FONT_SIZE_KEY,
    mmkvStorage,
  );
  const [storedFontFamily, setStoredFontFamily] = useMMKVString(
    READER_FONT_FAMILY_KEY,
    mmkvStorage,
  );

  // Out-of-bounds persisted values (older app version, manual edits) are
  // coerced rather than carried forward so the UI never starts in an
  // unreachable state.
  const fontSize =
    storedFontSize != null
      ? clampBibleReaderFontSize(storedFontSize)
      : BIBLE_READER_FONT.DEFAULT;
  const fontFamily: FontFamily = storedFontFamily ?? SOURCE_SERIF_FONT;

  const setFontSize = useCallback(
    (size: number) => {
      setStoredFontSize(clampBibleReaderFontSize(size));
    },
    [setStoredFontSize],
  );

  const setFontFamily = useCallback(
    (next: FontFamily) => {
      setStoredFontFamily(next);
    },
    [setStoredFontFamily],
  );

  return {
    fontSize,
    fontFamily,
    setFontSize,
    setFontFamily,
  };
}

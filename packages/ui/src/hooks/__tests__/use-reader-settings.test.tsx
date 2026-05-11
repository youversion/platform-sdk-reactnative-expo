import { act, renderHook } from "@testing-library/react-native";
import { BIBLE_READER_FONT } from "@youversion/platform-react-ui";

import { mmkvStorage } from "../../lib/storage";
import { INTER_FONT, SOURCE_SERIF_FONT } from "../../lib/reader-fonts";
import { useReaderSettings } from "../use-reader-settings";

describe("useReaderSettings", () => {
  beforeEach(() => {
    mmkvStorage.clearAll();
  });

  it("returns defaults when MMKV is empty", () => {
    const { result } = renderHook(() => useReaderSettings());

    expect(result.current.fontSize).toBe(BIBLE_READER_FONT.DEFAULT);
    expect(result.current.fontFamily).toBe(SOURCE_SERIF_FONT);
  });

  it("persists font size + family across rerenders via MMKV", () => {
    const first = renderHook(() => useReaderSettings());

    act(() => {
      first.result.current.setFontSize(BIBLE_READER_FONT.MAX);
      first.result.current.setFontFamily(INTER_FONT);
    });

    expect(first.result.current.fontSize).toBe(BIBLE_READER_FONT.MAX);
    expect(first.result.current.fontFamily).toBe(INTER_FONT);

    // A fresh hook instance hydrates from the same MMKV-backed store, proving
    // persistence (not just in-memory React state).
    const second = renderHook(() => useReaderSettings());
    expect(second.result.current.fontSize).toBe(BIBLE_READER_FONT.MAX);
    expect(second.result.current.fontFamily).toBe(INTER_FONT);
  });

  it("clamps font size on set above MAX and below MIN", () => {
    const { result } = renderHook(() => useReaderSettings());

    act(() => {
      result.current.setFontSize(9999);
    });
    expect(result.current.fontSize).toBe(BIBLE_READER_FONT.MAX);

    act(() => {
      result.current.setFontSize(-50);
    });
    expect(result.current.fontSize).toBe(BIBLE_READER_FONT.MIN);
  });

  it("clamps out-of-range stored font size on read", () => {
    mmkvStorage.set("yv-reader:font-size", 1000);

    const { result } = renderHook(() => useReaderSettings());
    expect(result.current.fontSize).toBe(BIBLE_READER_FONT.MAX);
  });
});

import { act, renderHook } from "@testing-library/react-native";
import { BIBLE_READER_FONT } from "@youversion/platform-react-ui";
import { useShallow } from "zustand/react/shallow";

import { mmkvStorage } from "@youversion/platform-react-native-expo-core";
import { READER_SETTINGS_PERSIST_KEY } from "../../lib/constants";
import { INTER_FONT, SOURCE_SERIF_FONT } from "../../lib/reader-fonts";
import { useReaderSettingsStore } from "../reader-settings-store";
import { READER_LINE_SPACING } from "../types/reader-line-spacing";

function useReaderSettingsSlice() {
  return useReaderSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      lineSpacing: s.lineSpacing,
      setFontSize: s.setFontSize,
      setFontFamily: s.setFontFamily,
      setLineSpacing: s.setLineSpacing,
    })),
  );
}

async function resetReaderSettingsStore() {
  mmkvStorage.clearAll();
  useReaderSettingsStore.setState({
    fontSize: BIBLE_READER_FONT.DEFAULT,
    fontFamily: SOURCE_SERIF_FONT,
    lineSpacing: READER_LINE_SPACING.DEFAULT,
  });
  await useReaderSettingsStore.persist.rehydrate();
}

describe("useReaderSettingsStore", () => {
  beforeEach(() => {
    return resetReaderSettingsStore();
  });

  it("returns defaults when MMKV is empty", () => {
    const { result } = renderHook(() => useReaderSettingsSlice());

    expect(result.current.fontSize).toBe(BIBLE_READER_FONT.DEFAULT);
    expect(result.current.fontFamily).toBe(SOURCE_SERIF_FONT);
    expect(result.current.lineSpacing).toBe(READER_LINE_SPACING.DEFAULT);
  });

  it("persists font size + family across rerenders via MMKV", () => {
    const first = renderHook(() => useReaderSettingsSlice());

    act(() => {
      first.result.current.setFontSize(BIBLE_READER_FONT.MAX);
      first.result.current.setFontFamily(INTER_FONT);
    });

    expect(first.result.current.fontSize).toBe(BIBLE_READER_FONT.MAX);
    expect(first.result.current.fontFamily).toBe(INTER_FONT);

    const second = renderHook(() => useReaderSettingsSlice());
    expect(second.result.current.fontSize).toBe(BIBLE_READER_FONT.MAX);
    expect(second.result.current.fontFamily).toBe(INTER_FONT);
  });

  it("clamps font size on set above MAX and below MIN", () => {
    const { result } = renderHook(() => useReaderSettingsSlice());

    act(() => {
      result.current.setFontSize(9999);
    });
    expect(result.current.fontSize).toBe(BIBLE_READER_FONT.MAX);

    act(() => {
      result.current.setFontSize(-50);
    });
    expect(result.current.fontSize).toBe(BIBLE_READER_FONT.MIN);
  });

  it("clamps out-of-range stored font size on read", async () => {
    mmkvStorage.set(
      READER_SETTINGS_PERSIST_KEY,
      JSON.stringify({
        state: { fontSize: 1000, fontFamily: SOURCE_SERIF_FONT },
        version: 0,
      }),
    );
    await useReaderSettingsStore.persist.rehydrate();

    const { result } = renderHook(() => useReaderSettingsSlice());
    expect(result.current.fontSize).toBe(BIBLE_READER_FONT.MAX);
  });

  it("persists line spacing across rerenders via MMKV", () => {
    const first = renderHook(() => useReaderSettingsSlice());

    act(() => {
      first.result.current.setLineSpacing(READER_LINE_SPACING.LG);
    });
    expect(first.result.current.lineSpacing).toBe(READER_LINE_SPACING.LG);

    const second = renderHook(() => useReaderSettingsSlice());
    expect(second.result.current.lineSpacing).toBe(READER_LINE_SPACING.LG);
  });

  it("coerces an unknown line spacing back to the default on set", () => {
    const { result } = renderHook(() => useReaderSettingsSlice());

    act(() => {
      result.current.setLineSpacing(99);
    });
    expect(result.current.lineSpacing).toBe(READER_LINE_SPACING.DEFAULT);
  });

  it("coerces an unknown stored line spacing back to the default on read", async () => {
    mmkvStorage.set(
      READER_SETTINGS_PERSIST_KEY,
      JSON.stringify({
        state: {
          fontSize: BIBLE_READER_FONT.DEFAULT,
          fontFamily: SOURCE_SERIF_FONT,
          lineSpacing: 99,
        },
        version: 0,
      }),
    );
    await useReaderSettingsStore.persist.rehydrate();

    const { result } = renderHook(() => useReaderSettingsSlice());
    expect(result.current.lineSpacing).toBe(READER_LINE_SPACING.DEFAULT);
  });
});

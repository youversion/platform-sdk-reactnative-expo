import { fireEvent, render } from "@testing-library/react-native";
import { BIBLE_READER_FONT } from "@youversion/platform-react-ui";
import { Text, View } from "react-native";
import type { ReactNode } from "react";

import { useShallow } from "zustand/react/shallow";

import { mmkvStorage } from "@youversion/platform-react-native-expo-core";
import { FONT_FAMILY_TOKEN, INTER_FONT, SOURCE_SERIF_FONT } from "../../lib/reader-fonts";
import { useReaderSettingsStore } from "../../stores/reader-settings-store";
import { READER_LINE_SPACING } from "../../stores/types/reader-line-spacing";
import { BibleReaderSettingsSheet } from "../bible-reader-settings-sheet";
import { YouVersionProvider } from "../youversion-provider";

// Stub the Expo DOM wrapper so we can assert orchestration without spinning
// up a WebView. The mock exposes the same handler props as testIDs so tests
// can invoke them directly.
jest.mock("../../dom/bible-reader-settings", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable: P, Text: T, View: V } = require("react-native");
  return {
    __esModule: true,
    default: function MockDOM(props: {
      fontSize: number;
      fontFamily: string;
      lineSpacing: number;
      onFontIncreased: () => Promise<void>;
      onFontDecreased: () => Promise<void>;
      onFontSelected: (next: string) => Promise<void>;
      onLineSpacingChange: () => Promise<void>;
    }) {
      return (
        <V testID="mock-dom">
          <T testID="font-size">{String(props.fontSize)}</T>
          <T testID="font-family">{props.fontFamily}</T>
          <T testID="line-spacing">{String(props.lineSpacing)}</T>
          <P testID="increase" onPress={() => props.onFontIncreased()}>
            <T>A+</T>
          </P>
          <P testID="decrease" onPress={() => props.onFontDecreased()}>
            <T>A-</T>
          </P>
          <P testID="select-inter" onPress={() => props.onFontSelected('"Inter", sans-serif')}>
            <T>Inter</T>
          </P>
          <P testID="cycle-line-spacing" onPress={() => props.onLineSpacingChange()}>
            <T>Line spacing</T>
          </P>
        </V>
      );
    },
  };
});

// Render the sheet inline so we don't depend on the portal/host machinery in
// jest-expo and can observe the DOM stub's props directly.
jest.mock("../native-sheet", () => {
  const actual = jest.requireActual("../native-sheet");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: V } = require("react-native");
  return {
    ...actual,
    NativeSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <V testID="sheet">{children}</V> : null,
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
);

function SheetHarness({ isOpen }: { isOpen: boolean }) {
  // Subscribe here so we can read the latest values back out via testIDs and
  // confirm that handler calls round-trip through persisted settings.
  const { fontSize, fontFamily, lineSpacing } = useReaderSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      lineSpacing: s.lineSpacing,
    })),
  );
  return (
    <>
      <View testID="harness-font-size">
        <Text>{String(fontSize)}</Text>
      </View>
      <View testID="harness-font-family">
        <Text>{fontFamily}</Text>
      </View>
      <View testID="harness-line-spacing">
        <Text>{String(lineSpacing)}</Text>
      </View>
      <BibleReaderSettingsSheet isSettingsSheetOpen={isOpen} onClose={() => {}} />
    </>
  );
}

describe("BibleReaderSettingsSheet", () => {
  beforeEach(() => {
    mmkvStorage.clearAll();
    useReaderSettingsStore.setState({
      fontSize: BIBLE_READER_FONT.DEFAULT,
      fontFamily: SOURCE_SERIF_FONT,
      lineSpacing: READER_LINE_SPACING.DEFAULT,
    });
    return useReaderSettingsStore.persist.rehydrate();
  });

  it("renders nothing when isOpen is false", () => {
    const { queryByTestId } = render(<SheetHarness isOpen={false} />, {
      wrapper,
    });

    expect(queryByTestId("sheet")).toBeNull();
    expect(queryByTestId("mock-dom")).toBeNull();
  });

  it("renders the DOM content with current settings when open", () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper });

    expect(getByTestId("sheet")).toBeTruthy();
    expect(getByTestId("font-size").children).toContain(
      String(BIBLE_READER_FONT.DEFAULT),
    );
    // fontFamily crosses the bridge as a quote-free token (the canonical stack
    // contains a `"`, which @expo/dom-webview corrupts on iOS); the DOM
    // component decodes it back to SOURCE_SERIF_FONT for the Web SDK.
    expect(getByTestId("font-family").children).toContain(
      FONT_FAMILY_TOKEN.SOURCE_SERIF,
    );
    expect(getByTestId("line-spacing").children).toContain(
      String(READER_LINE_SPACING.DEFAULT),
    );
  });

  it("increase/decrease handlers step font size by STEP and clamp at bounds", () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper });

    fireEvent.press(getByTestId("increase"));
    expect(getByTestId("harness-font-size").children[0]).toHaveProperty(
      "props.children",
      String(BIBLE_READER_FONT.DEFAULT + BIBLE_READER_FONT.STEP),
    );

    // Drop straight to MIN: spam decrease past the lower bound.
    for (let i = 0; i < 10; i++) {
      fireEvent.press(getByTestId("decrease"));
    }
    expect(getByTestId("harness-font-size").children[0]).toHaveProperty(
      "props.children",
      String(BIBLE_READER_FONT.MIN),
    );
  });

  it("font-family handler swaps the persisted family", () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper });

    fireEvent.press(getByTestId("select-inter"));
    expect(getByTestId("harness-font-family").children[0]).toHaveProperty(
      "props.children",
      INTER_FONT,
    );
  });

  it("line-spacing handler cycles the persisted spacing DEFAULT -> LG", () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper });

    fireEvent.press(getByTestId("cycle-line-spacing"));
    expect(getByTestId("harness-line-spacing").children[0]).toHaveProperty(
      "props.children",
      String(READER_LINE_SPACING.LG),
    );
  });
});

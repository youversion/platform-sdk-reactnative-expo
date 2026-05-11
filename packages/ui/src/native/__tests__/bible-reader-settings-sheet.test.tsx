import { fireEvent, render } from "@testing-library/react-native";
import { BIBLE_READER_FONT } from "@youversion/platform-react-ui";
import { Text, View } from "react-native";
import type { ReactNode } from "react";

import { mmkvStorage } from "../../lib/storage";
import { INTER_FONT, SOURCE_SERIF_FONT } from "../../lib/reader-fonts";
import { BibleReaderSettingsSheet } from "../bible-reader-settings-sheet";
import { useReaderSettings } from "../../hooks/use-reader-settings";
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
      onFontIncreased: () => Promise<void>;
      onFontDecreased: () => Promise<void>;
      onFontSelected: (next: string) => Promise<void>;
    }) {
      return (
        <V testID="mock-dom">
          <T testID="font-size">{String(props.fontSize)}</T>
          <T testID="font-family">{props.fontFamily}</T>
          <P testID="increase" onPress={() => props.onFontIncreased()}>
            <T>A+</T>
          </P>
          <P testID="decrease" onPress={() => props.onFontDecreased()}>
            <T>A-</T>
          </P>
          <P testID="select-inter" onPress={() => props.onFontSelected('"Inter", sans-serif')}>
            <T>Inter</T>
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
  // Mounting the hook here lets us read the latest values back out via testIDs
  // and confirm that handler calls round-trip through MMKV.
  const settings = useReaderSettings();
  return (
    <>
      <View testID="harness-font-size">
        <Text>{String(settings.fontSize)}</Text>
      </View>
      <View testID="harness-font-family">
        <Text>{settings.fontFamily}</Text>
      </View>
      <BibleReaderSettingsSheet isOpen={isOpen} onClose={() => {}} />
    </>
  );
}

describe("BibleReaderSettingsSheet", () => {
  beforeEach(() => {
    mmkvStorage.clearAll();
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
    expect(getByTestId("font-family").children).toContain(SOURCE_SERIF_FONT);
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
});

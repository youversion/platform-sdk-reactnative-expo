import { fireEvent, render } from "@testing-library/react-native";
import type { FootnoteData } from "@youversion/platform-react-ui";
import * as ReactNative from "react-native";
import { Platform } from "react-native";
import type { ReactNode } from "react";

import { BibleTextView } from "../bible-text-view";
import { youVersionProviderWrapper as wrapper } from "@/test-utils/youversion-provider-wrapper";

const sampleFootnote: FootnoteData = {
  verseNum: "3",
  notes: [],
  verseHtml: "<p>footnote</p>",
};

jest.mock("../../dom/bible-text-view", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, View } = require("react-native");
  return {
    __esModule: true,
    default: function MockBibleTextViewDOM(props: {
      appKey: string;
      reference?: string;
      versionId?: number;
      showVerseNumbers?: boolean;
      fontSize?: number;
      theme?: string;
      onFootnotePress?: (data: FootnoteData) => Promise<void>;
    }) {
      return (
        <View testID="mock-btv-dom">
          <Text testID="mock-app-key">{props.appKey}</Text>
          <Text testID="mock-reference">{props.reference ?? ""}</Text>
          <Text testID="mock-version-id">{String(props.versionId ?? "")}</Text>
          <Text testID="mock-show-verse-numbers">
            {props.showVerseNumbers === true ? "1" : "0"}
          </Text>
          <Text testID="mock-font-size">{String(props.fontSize ?? "")}</Text>
          <Text testID="mock-theme">{props.theme ?? ""}</Text>
          <Text testID="mock-has-footnote-handler">
            {typeof props.onFootnotePress === "function" ? "yes" : "no"}
          </Text>
          <Pressable
            testID="mock-footnote-trigger"
            onPress={() => void props.onFootnotePress?.(sampleFootnote)}
          >
            <Text>footnote</Text>
          </Pressable>
        </View>
      );
    },
  };
});

jest.mock("../../dom/footnote-content", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text, View } = require("react-native");
  return {
    __esModule: true,
    default: function MockFootnoteContent(props: {
      data: FootnoteData;
      theme?: string;
      fontSize?: number;
      appKey: string;
    }) {
      return (
        <View testID="mock-footnote-content">
          <Text testID="mock-footnote-verse">{props.data.verseNum}</Text>
          <Text testID="mock-footnote-theme">{props.theme ?? ""}</Text>
          <Text testID="mock-footnote-font-size">{String(props.fontSize ?? "")}</Text>
          <Text testID="mock-footnote-app-key">{props.appKey}</Text>
        </View>
      );
    },
  };
});

jest.mock("../native-sheet", () => {
  const actual = jest.requireActual("../native-sheet");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, View } = require("react-native");
  return {
    ...actual,
    NativeSheet: ({
      isOpen,
      onClose,
      children,
    }: {
      isOpen: boolean;
      onClose: () => void;
      children: ReactNode;
    }) =>
      isOpen ? (
        <View testID="footnote-sheet">
          <Pressable testID="footnote-sheet-close" onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
          {children}
        </View>
      ) : null,
  };
});

describe("BibleTextView", () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      enumerable: true,
      value: originalOs,
    });
  });

  it("forwards appKey from YouVersionProvider and passage props to the DOM entry", () => {
    const { getByTestId } = render(
      <BibleTextView
        reference="JHN.1.1-4"
        versionId={3034}
        showVerseNumbers
        fontSize={18}
      />,
      { wrapper: wrapper() },
    );

    expect(getByTestId("mock-app-key").children).toContain("test-key");
    expect(getByTestId("mock-reference").children).toContain("JHN.1.1-4");
    expect(getByTestId("mock-version-id").children).toContain("3034");
    expect(getByTestId("mock-show-verse-numbers").children).toContain("1");
    expect(getByTestId("mock-font-size").children).toContain("18");
  });

  it("forwards a component-level theme override to the DOM entry", () => {
    const { getByTestId } = render(
      <BibleTextView reference="GEN.1.1" versionId={1} theme="dark" />,
      { wrapper: wrapper("light") },
    );

    expect(getByTestId("mock-theme").children).toContain("dark");
  });

  it("opens the native footnote sheet with footnote data when no consumer handler is provided", () => {
    const { getByTestId, queryByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    );

    expect(queryByTestId("footnote-sheet")).toBeNull();

    fireEvent.press(getByTestId("mock-footnote-trigger"));

    expect(getByTestId("footnote-sheet")).toBeTruthy();
    expect(getByTestId("mock-footnote-verse").children).toContain("3");
    expect(getByTestId("mock-footnote-app-key").children).toContain("test-key");
  });

  it("invokes consumer onFootnotePress and does not mount the default footnote sheet", () => {
    const consumer = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, queryByTestId } = render(
      <BibleTextView
        reference="JHN.1.1"
        versionId={3034}
        onFootnotePress={consumer}
      />,
      { wrapper: wrapper() },
    );

    fireEvent.press(getByTestId("mock-footnote-trigger"));

    expect(consumer).toHaveBeenCalledTimes(1);
    expect(consumer).toHaveBeenCalledWith(sampleFootnote);
    expect(queryByTestId("footnote-sheet")).toBeNull();
  });

  it("throws when YouVersionProvider is missing", () => {
    expect(() =>
      render(<BibleTextView reference="JHN.1.1" versionId={3034} />),
    ).toThrow(
      'YouVersionProvider is required. Wrap your app with <YouVersionProvider appKey="...">.',
    );
  });

  it("does not wire footnote handling on web", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      enumerable: true,
      value: "web",
    });

    const { getByTestId, queryByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    );

    expect(getByTestId("mock-has-footnote-handler").children).toContain("no");
    fireEvent.press(getByTestId("mock-footnote-trigger"));
    expect(queryByTestId("footnote-sheet")).toBeNull();
  });

  it("closes the footnote sheet when NativeSheet calls onClose", () => {
    const { getByTestId, queryByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    );

    fireEvent.press(getByTestId("mock-footnote-trigger"));
    expect(getByTestId("footnote-sheet")).toBeTruthy();

    fireEvent.press(getByTestId("footnote-sheet-close"));
    expect(queryByTestId("footnote-sheet")).toBeNull();
  });

  it("resolves system theme for footnote content from useColorScheme when dark", () => {
    const spy = jest
      .spyOn(ReactNative, "useColorScheme")
      .mockReturnValue("dark");

    const { getByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper("light") },
    );

    fireEvent.press(getByTestId("mock-footnote-trigger"));

    expect(getByTestId("mock-footnote-theme").children).toContain("dark");

    spy.mockRestore();
  });

  it("resolves system theme to light when useColorScheme is not dark", () => {
    const spy = jest
      .spyOn(ReactNative, "useColorScheme")
      .mockReturnValue("light");

    const { getByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper("light") },
    );

    fireEvent.press(getByTestId("mock-footnote-trigger"));

    expect(getByTestId("mock-footnote-theme").children).toContain("light");

    spy.mockRestore();
  });
});

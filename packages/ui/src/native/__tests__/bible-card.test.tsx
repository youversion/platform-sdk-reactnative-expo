import { render } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { BibleCard } from "../bible-card";
import { youVersionProviderWrapper as wrapper } from "../../test-utils/youversion-provider-wrapper";

jest.mock("../bible-version-picker-sheet", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return {
    BibleVersionPickerSheet: () => <View testID="mock-version-picker-sheet-stub" />,
  };
});

jest.mock("../native-sheet", () => {
  const actual = jest.requireActual("../native-sheet");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return {
    ...actual,
    NativeSheet: () => <View testID="mock-footnote-sheet-stub" />,
  };
});

jest.mock("../../dom/bible-card", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text, View } = require("react-native");
  return {
    __esModule: true,
    default: function MockBibleCardDOM(props: {
      appKey: string;
      reference?: string;
      versionId?: number;
      theme?: string;
      dom?: { matchContents?: boolean };
    }) {
      return (
        <View testID="mock-bible-card-dom">
          <Text testID="mock-app-key">{props.appKey}</Text>
          <Text testID="mock-reference">{props.reference ?? ""}</Text>
          <Text testID="mock-version-id">{String(props.versionId ?? "")}</Text>
          <Text testID="mock-theme">{props.theme ?? ""}</Text>
          <Text testID="mock-dom-match-contents">
            {props.dom?.matchContents === true ? "1" : "0"}
          </Text>
        </View>
      );
    },
  };
});

describe("BibleCard", () => {
  it("forwards appKey from YouVersionProvider and passage props to the DOM entry", () => {
    const { getByTestId } = render(
      <BibleCard
        reference="JHN.3.16"
        versionId={3034}
        dom={{ matchContents: true }}
      />,
      { wrapper: wrapper() },
    );

    expect(getByTestId("mock-app-key").children).toContain("test-key");
    expect(getByTestId("mock-reference").children).toContain("JHN.3.16");
    expect(getByTestId("mock-version-id").children).toContain("3034");
    expect(getByTestId("mock-dom-match-contents").children).toContain("1");
  });

  it("forwards a component-level theme override to the DOM entry", () => {
    const { getByTestId } = render(
      <BibleCard reference="GEN.1.1" versionId={1} theme="dark" />,
      { wrapper: wrapper("light") },
    );

    expect(getByTestId("mock-theme").children).toContain("dark");
  });

  it('resolves theme="system" to the provider theme before passing to the DOM entry', () => {
    const { getByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper("light") },
    );

    expect(getByTestId("mock-theme").children).toContain("light");
  });

  it("uses the provider-resolved theme when BibleCard does not set theme", () => {
    const { getByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper("dark") },
    );

    expect(getByTestId("mock-theme").children).toContain("dark");
  });

  it("uses provider-resolved theme when provider theme is system and color scheme is dark", () => {
    const spy = jest
      .spyOn(ReactNative, "useColorScheme")
      .mockReturnValue("dark");

    const { getByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper("system") },
    );

    try {
      expect(getByTestId("mock-theme").children).toContain("dark");
    } finally {
      spy.mockRestore();
    }
  });

  it("throws when YouVersionProvider is missing", () => {
    expect(() =>
      render(<BibleCard reference="JHN.1.1" versionId={3034} />),
    ).toThrow(
      'YouVersionProvider is required. Wrap your app with <YouVersionProvider appKey="...">.',
    );
  });
});

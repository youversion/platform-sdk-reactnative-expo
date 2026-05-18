import { render } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { VerseOfTheDay } from "../verse-of-the-day";
import { youVersionProviderWrapper as wrapper } from "../../test-utils/youversion-provider-wrapper";

jest.mock("../../dom/verse-of-the-day", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text, View } = require("react-native");
  return {
    __esModule: true,
    default: function MockVerseOfTheDayDOM(props: {
      appKey: string;
      versionId?: number;
      theme?: string;
      dom?: { matchContents?: boolean };
    }) {
      return (
        <View testID="mock-votd-dom">
          <Text testID="mock-app-key">{props.appKey}</Text>
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

describe("VerseOfTheDay", () => {
  it("forwards appKey from YouVersionProvider and consumer props to the DOM entry", () => {
    const { getByTestId } = render(
      <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />,
      { wrapper: wrapper() },
    );

    expect(getByTestId("mock-app-key").children).toContain("test-key");
    expect(getByTestId("mock-version-id").children).toContain("3034");
    expect(getByTestId("mock-dom-match-contents").children).toContain("1");
  });

  it("forwards a component-level theme override to the DOM entry", () => {
    const { getByTestId } = render(
      <VerseOfTheDay versionId={3034} theme="dark" />,
      { wrapper: wrapper("light") },
    );

    expect(getByTestId("mock-theme").children).toContain("dark");
  });

  it('forwards theme="system" from VerseOfTheDay props to the DOM entry', () => {
    const { getByTestId } = render(
      <VerseOfTheDay versionId={3034} theme="system" />,
      { wrapper: wrapper("light") },
    );

    expect(getByTestId("mock-theme").children).toContain("system");
  });

  it("uses the provider-resolved theme when VerseOfTheDay does not set theme", () => {
    const { getByTestId } = render(
      <VerseOfTheDay versionId={3034} />,
      { wrapper: wrapper("dark") },
    );

    expect(getByTestId("mock-theme").children).toContain("dark");
  });

  it("uses provider-resolved theme when provider theme is system and color scheme is dark", () => {
    const spy = jest
      .spyOn(ReactNative, "useColorScheme")
      .mockReturnValue("dark");

    const { getByTestId } = render(
      <VerseOfTheDay versionId={3034} />,
      { wrapper: wrapper("system") },
    );

    expect(getByTestId("mock-theme").children).toContain("dark");

    spy.mockRestore();
  });

  it("throws when YouVersionProvider is missing", () => {
    expect(() => render(<VerseOfTheDay versionId={3034} />)).toThrow(
      'YouVersionProvider is required. Wrap your app with <YouVersionProvider appKey="...">.',
    );
  });
});

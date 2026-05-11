"use dom";

import {
  BibleThemeSettingsContent,
  YouVersionProvider,
} from "@youversion/platform-react-ui";

import type { FontFamily } from "../lib/reader-fonts";

export type BibleReaderSettingsDOMProps = {
  appKey: string;
  theme: "light" | "dark";
  fontSize: number;
  fontFamily: FontFamily;
  // Expo DOM function props always cross the native <-> WebView bridge, so they must be async.
  onFontIncreased: () => Promise<void>;
  onFontDecreased: () => Promise<void>;
  onFontSelected: (fontFamily: FontFamily) => Promise<void>;
  dom?: import("expo/dom").DOMProps;
};

export default function BibleReaderSettingsDOM({
  appKey,
  theme,
  fontSize,
  fontFamily,
  onFontIncreased,
  onFontDecreased,
  onFontSelected,
}: BibleReaderSettingsDOMProps) {
  // React invokes button onClick handlers with a SyntheticEvent. That event
  // isn't JSON-serializable, so passing the bridge-bound handlers straight
  // through would crash the DOM <-> native bridge. These wrappers swallow the
  // event and forward only serializable args.
  const handleFontIncreased = () => {
    void onFontIncreased();
  };
  const handleFontDecreased = () => {
    void onFontDecreased();
  };
  const handleFontSelected = (family: FontFamily) => {
    void onFontSelected(family);
  };

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div style={{ width: "100%", maxWidth: "32rem" }}>
          <BibleThemeSettingsContent
            theme={theme}
            fontSize={fontSize}
            fontFamily={fontFamily}
            onFontIncreased={handleFontIncreased}
            onFontDecreased={handleFontDecreased}
            onFontSelected={handleFontSelected}
          />
        </div>
      </div>
    </YouVersionProvider>
  );
}

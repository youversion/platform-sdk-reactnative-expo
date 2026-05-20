import { createContext, useContext, type ReactNode } from "react";
import * as ReactNative from "react-native";
import { resolveTheme } from "../lib/resolve-theme";
import { NativeSheetProvider } from "./native-sheet";

type Theme = "light" | "dark";
export type YouVersionTheme = Theme | "system";

type YouVersionContextValue = {
  appKey: string;
  theme: Theme;
};

const YouVersionContext = createContext<YouVersionContextValue | null>(null);

export type YouVersionProviderProps = {
  appKey: string;
  theme?: YouVersionTheme;
  children: ReactNode;
};

export function YouVersionProvider({
  appKey,
  theme = "light",
  children,
}: YouVersionProviderProps) {
  const colorScheme = ReactNative.useColorScheme();
  const resolvedTheme = resolveTheme(theme, colorScheme);

  return (
    <YouVersionContext.Provider value={{ appKey, theme: resolvedTheme }}>
      <NativeSheetProvider>{children}</NativeSheetProvider>
    </YouVersionContext.Provider>
  );
}

export function useYouVersion() {
  const context = useContext(YouVersionContext);
  if (!context) {
    throw new Error(
      'YouVersionProvider is required. Wrap your app with <YouVersionProvider appKey="...">.',
    );
  }
  return context;
}

import type { ComponentType, ReactNode } from "react";

import { YouVersionProvider } from "../youversion-provider";

/** RTL `wrapper` factory shared by native component tests that need `YouVersionProvider`. */
export function youVersionProviderWrapper(
  providerTheme: "light" | "dark" | "system" = "light",
): ComponentType<{ children: ReactNode }> {
  function YouVersionTestWrapper({ children }: { children: ReactNode }) {
    return (
      <YouVersionProvider appKey="test-key" theme={providerTheme}>
        {children}
      </YouVersionProvider>
    );
  }
  return YouVersionTestWrapper;
}

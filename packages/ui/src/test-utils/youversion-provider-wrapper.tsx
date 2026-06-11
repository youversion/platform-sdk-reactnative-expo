import type { ComponentType, ReactNode } from "react";

import { YouVersionProvider } from "../native/youversion-provider";

/** RTL `wrapper` factory shared by native component tests that need `YouVersionProvider`. */
export function youVersionProviderWrapper(
  providerTheme: "light" | "dark" | "system" = "light",
  locale?: string,
): ComponentType<{ children: ReactNode }> {
  function YouVersionTestWrapper({ children }: { children: ReactNode }) {
    return (
      <YouVersionProvider appKey="test-key" theme={providerTheme} locale={locale}>
        {children}
      </YouVersionProvider>
    );
  }
  return YouVersionTestWrapper;
}

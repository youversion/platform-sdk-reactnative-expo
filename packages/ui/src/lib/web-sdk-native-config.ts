import { YouVersionPlatformConfiguration } from '@youversion/platform-core'

/**
 * Seeds the Web SDK's global configuration (`@youversion/platform-core`) for use
 * in the **native** React tree (e.g. `usePassage` via the hooks `YouVersionProvider`).
 *
 * The hooks provider builds its context from `YouVersionPlatformConfiguration.installationId`,
 * whose getter otherwise calls `getOrSetInstallationId()` → bare `localStorage`.
 * React Native's Hermes runtime defines `window` but **not** `localStorage`, so the
 * SDK's `typeof window === 'undefined'` guard does not catch it and the read throws
 * `localStorage is not defined`. Passing a truthy id to the setter writes it directly
 * (`_installationId = value`), so the `localStorage` branch never runs.
 *
 * This is the native-tree analogue of the DOM `applySDKConfig` (`dom-apply.ts`),
 * which seeds the same global *inside* the WebView. Idempotent; lives in a plain
 * module (not a component/hook) so seeding the SDK singleton is a normal call
 * rather than an in-render mutation.
 */
export function applyNativeWebSdkConfig(installationId: string): void {
  YouVersionPlatformConfiguration.installationId = installationId
}

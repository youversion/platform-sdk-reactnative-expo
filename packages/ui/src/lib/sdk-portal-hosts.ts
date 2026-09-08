/**
 * Named host for SDK popovers. Sheets keep `native-sheet-host`.
 * A named host avoids the unnamed default that rn-primitives tells apps to
 * mount, which would paint the same popover twice.
 */
export const SDK_POPOVER_HOST_NAME = 'native-popover-host'

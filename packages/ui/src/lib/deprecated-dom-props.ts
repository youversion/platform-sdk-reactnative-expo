import type { DOMProps } from 'expo/dom'

/**
 * Former Expo DOM `dom` prop shape. Native renderers ignore every field.
 * Kept as the full `DOMProps` type so hosts that still pass extra keys typecheck
 * until the next major removes the prop.
 */
export type DeprecatedDomProps = DOMProps

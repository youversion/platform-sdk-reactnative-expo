import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/** Decorative. The clear-search button carries the localized label. */
export function ClearIcon({ color, size = 18, ...props }: SvgProps & { size?: number }): ReactNode {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...props}
    >
      <Path d="M7 7l10 10M17 7L7 17" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

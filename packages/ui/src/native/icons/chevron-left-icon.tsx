import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/** Decorative. The button around it carries the localized label. */
export function ChevronLeftIcon({
  color,
  size = 20,
  ...props
}: SvgProps & { size?: number }): ReactNode {
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
      <Path
        d="M15 18L9 12L15 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

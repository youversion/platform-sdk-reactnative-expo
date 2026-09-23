import type { ReactNode } from 'react'
import Svg, { Circle, Line, type SvgProps } from 'react-native-svg'

/** Decorative. The search field carries the localized label. */
export function SearchIcon({
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
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Line x1={16} y1={16} x2={21} y2={21} stroke={color} strokeWidth={2} />
    </Svg>
  )
}

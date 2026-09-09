import type { ReactNode } from 'react'
import Svg, { Circle, type SvgProps } from 'react-native-svg'

/** Decorative. The button around it carries the localized label. */
export function MoreIcon({ color, size = 24, ...props }: SvgProps & { size?: number }): ReactNode {
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
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} />
      <Circle cx={8} cy={12} r={1.25} fill={color} />
      <Circle cx={12} cy={12} r={1.25} fill={color} />
      <Circle cx={16} cy={12} r={1.25} fill={color} />
    </Svg>
  )
}

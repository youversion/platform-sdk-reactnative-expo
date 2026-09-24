import type { ReactNode } from 'react'
import Svg, { Circle, Line, type SvgProps } from 'react-native-svg'

/** Decorative. The chapter button carries the localized introduction label. */
export function InfoIcon({ color, size = 20, ...props }: SvgProps & { size?: number }): ReactNode {
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
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Line x1={12} y1={11} x2={12} y2={17} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={7.5} r={1} fill={color} />
    </Svg>
  )
}

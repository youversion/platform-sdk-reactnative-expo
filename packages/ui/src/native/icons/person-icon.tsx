import type { ReactNode } from 'react'
import Svg, { Ellipse, Path, type SvgProps } from 'react-native-svg'

/**
 * Decorative. San Francisco `person` — oval head and a shoulder arc. Same
 * glyph iOS uses next to Sign in and Sign out.
 */
export function PersonIcon({
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
      <Ellipse
        cx={12}
        cy={7.15}
        rx={4.05}
        ry={4.9}
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="M4.4 20.4c0-4.6 3.2-7 7.6-7s7.6 2.4 7.6 7"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  )
}

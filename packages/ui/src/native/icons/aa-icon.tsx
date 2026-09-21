import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/** Decorative. The menu row around it carries the localized label. */
export function AaIcon({ color, size = 16, ...props }: SvgProps & { size?: number }): ReactNode {
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
        d="m3 16 4.464-12h1.072L13 16"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.5 12h8"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 9h1.5a2.5 2.5 0 1 1 0 5H18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M18 14h3" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M18 9v10" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  )
}

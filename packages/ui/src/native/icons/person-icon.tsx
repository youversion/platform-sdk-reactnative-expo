import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/** Decorative. The menu row around it carries the localized label. */
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
      <Path
        d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
        stroke={color}
        strokeWidth={1.75}
      />
      <Path
        d="M5 20C5.8 17.2 8.6 15.5 12 15.5C15.4 15.5 18.2 17.2 19 20"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  )
}

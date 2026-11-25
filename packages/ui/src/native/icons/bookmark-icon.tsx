import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/** Decorative. The button or header around it carries the localized label. */
export function BookmarkIcon({
  color,
  size = 20,
  ...props
}: SvgProps & { size?: number }): ReactNode {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...props}
    >
      <Path
        d="M5 3.25C5 2.56 5.56 2 6.25 2h7.5C14.44 2 15 2.56 15 3.25V17.1c0 .55-.63.86-1.07.53L10 14.4l-3.93 3.23C5.63 17.96 5 17.65 5 17.1V3.25Z"
        fill={color}
      />
    </Svg>
  )
}

import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/**
 * Magnifying glass for the native Reader Search control.
 *
 * Decorative: the button around it carries the localized label.
 */
export function SearchIcon({
  color,
  size = 24,
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
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z"
        fill={color}
      />
    </Svg>
  )
}

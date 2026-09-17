import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/** Decorative. The menu row around it carries the localized label. */
export function FontSettingsIcon({
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
        d="M3.5 18L8 6H10L14.5 18H12.6L11.55 15.1H6.45L5.4 18H3.5ZM7.05 13.4H10.95L9.05 8.15H8.95L7.05 13.4Z"
        fill={color}
      />
      <Path
        d="M15.2 18L18 10.5H19.3L22.1 18H20.85L20.2 16.15H17.1L16.45 18H15.2ZM17.5 15.1H19.8L18.7 12H18.6L17.5 15.1Z"
        fill={color}
      />
    </Svg>
  )
}

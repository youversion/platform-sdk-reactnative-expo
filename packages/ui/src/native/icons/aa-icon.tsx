import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/**
 * Decorative. San Francisco `textformat.size` — two capital A's, small then
 * large on one baseline. Same glyph Swift uses for font size.
 */
export function AaIcon({ color, size = 20, ...props }: SvgProps & { size?: number }): ReactNode {
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
        d="M1.2 19.213 4.523 10.269 5.353 10.269 5.353 11.627 5.056 11.627 2.372 19.213ZM2.719 16.653 3.087 15.705 7.067 15.705 7.435 16.653ZM7.773 19.213 5.094 11.627 5.094 10.269 5.626 10.269 8.944 19.213Z"
        fill={color}
      />
      <Path
        d="M10.309 19.213 15.669 4.787 17.008 4.787 17.008 6.977 16.528 6.977 12.199 19.213ZM12.76 15.084 13.352 13.555 19.773 13.555 20.365 15.084ZM20.91 19.213 16.59 6.977 16.59 4.787 17.449 4.787 22.8 19.213Z"
        fill={color}
      />
    </Svg>
  )
}

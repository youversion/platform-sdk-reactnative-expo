import type { ReactNode } from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

/**
 * The Share glyph on the verse action sheet: the box-arrow-up matching the
 * shipped YouVersion Bible app, not the "share nodes" glyph in the mock.
 *
 * Decorative, for the same reason as {@link CopyIcon}: the button around it
 * carries the localized label.
 */
export function ShareIcon({
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
        d="M16.1213 9.18728C15.7307 9.57781 15.0976 9.57781 14.707 9.18728L13 7.48023V15C13 15.5523 12.5523 16 12 16C11.4477 16 11 15.5523 11 15V7.34819L9.12126 9.22693C8.73074 9.61746 8.09757 9.61746 7.70705 9.22693C7.31652 8.83641 7.31652 8.20324 7.70705 7.81272L11.2269 4.29289C11.6174 3.90237 12.2506 3.90237 12.6411 4.29289L16.1213 7.77307C16.5118 8.16359 16.5118 8.79676 16.1213 9.18728Z"
        fill={color}
      />
      <Path
        d="M6 12C5.44772 12 5 12.4478 5 13V18C5 19.1046 5.89543 20 7 20H17C18.1046 20 19 19.1046 19 18V13C19 12.4478 18.5523 12 18 12C17.4477 12 17 12.4478 17 13V17.5C17 17.7762 16.7761 18 16.5 18H7.5C7.22386 18 7 17.7762 7 17.5V13C7 12.4478 6.55228 12 6 12Z"
        fill={color}
      />
    </Svg>
  )
}

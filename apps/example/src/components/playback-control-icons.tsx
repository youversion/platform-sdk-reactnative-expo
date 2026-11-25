import type { ReactNode } from 'react'
import Svg, { Path, Rect, type SvgProps } from 'react-native-svg'

/** Play triangle for the dark circular control (Figma path). */
export function PlayGlyph({ size = 24, ...props }: SvgProps & { size?: number }): ReactNode {
  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <Path
        d="M18.757 8.6658C20.9331 9.92219 22.0212 10.5504 22.257 11.4306C22.357 11.8036 22.357 12.1964 22.257 12.5694C22.0212 13.4496 20.9331 14.0778 18.757 15.3342L10.7605 19.951C8.58438 21.2074 7.49632 21.8356 6.6161 21.5997C6.24308 21.4998 5.90294 21.3034 5.62987 21.0303C4.9855 20.3859 4.9855 19.1296 4.9855 16.6168L4.9855 7.38321C4.9855 4.87044 4.9855 3.61406 5.62987 2.96969C5.90294 2.69662 6.24308 2.50024 6.6161 2.40029C7.49632 2.16444 8.58438 2.79263 10.7605 4.04902L18.757 8.6658Z"
        fill="white"
      />
    </Svg>
  )
}

/** Pause bars for the same 24pt slot. */
export function PauseGlyph({ size = 24, ...props }: SvgProps & { size?: number }): ReactNode {
  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <Rect fill="white" height={12} rx={1.5} width={3.5} x={7} y={6} />
      <Rect fill="white" height={12} rx={1.5} width={3.5} x={13.5} y={6} />
    </Svg>
  )
}

/** Corner-arrows expand glyph for fullscreen. */
export function ExpandGlyph({ size = 24, ...props }: SvgProps & { size?: number }): ReactNode {
  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <Path
        d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </Svg>
  )
}

/** Inward corner arrows that collapse fullscreen back to inline. */
export function CollapseGlyph({ size = 24, ...props }: SvgProps & { size?: number }): ReactNode {
  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <Path
        d="M4 8h3a1 1 0 0 0 1-1V4M20 8h-3a1 1 0 0 1-1-1V4M4 16h3a1 1 0 0 1 1 1v3M20 16h-3a1 1 0 0 0-1 1v3"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </Svg>
  )
}

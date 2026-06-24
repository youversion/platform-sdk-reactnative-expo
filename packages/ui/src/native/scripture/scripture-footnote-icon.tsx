import Svg, { Path, type SvgProps } from 'react-native-svg'

/**
 * Footnote/note marker icon — the same note-bubble glyph the Web SDK renders for
 * `[data-verse-footnote]` markers (`Footnote` in `@youversion/platform-react-ui`,
 * a 24×24 `currentColor` path). Reproduced as a native SVG so the native reader's
 * markers match the web reader instead of a placeholder `*`.
 */
const FOOTNOTE_ICON_PATH =
  'M5.00033 4.16667C4.09255 4.16667 3.33366 4.92556 3.33366 5.83333V12.5C3.33366 13.4078 4.09255 14.1667 5.00033 14.1667H6.66699C7.12723 14.1667 7.50033 14.5398 7.50033 15V16.0282L10.4049 14.2854C10.5344 14.2077 10.6826 14.1667 10.8337 14.1667H15.0003C15.9081 14.1667 16.667 13.4078 16.667 12.5V5.83333C16.667 4.92556 15.9081 4.16667 15.0003 4.16667H5.00033ZM5.00033 2.5H15.0003C16.8159 2.5 18.3337 4.01778 18.3337 5.83333V12.5C18.3337 14.3156 16.8159 15.8333 15.0003 15.8333H11.0645L7.09574 18.2146C6.55059 18.5417 5.83366 18.1357 5.83366 17.5V15.8333H5.00033C3.18477 15.8333 1.66699 14.3156 1.66699 12.5V5.83333C1.66699 4.01778 3.18477 2.5 5.00033 2.5ZM5.83366 7.5C5.83366 7.03976 6.20675 6.66667 6.66699 6.66667H13.3337C13.7939 6.66667 14.167 7.03976 14.167 7.5C14.167 7.96024 13.7939 8.33333 13.3337 8.33333H6.66699C6.20675 8.33333 5.83366 7.96024 5.83366 7.5ZM5.83366 10.8333C5.83366 10.3731 6.20675 10 6.66699 10H11.667C12.1272 10 12.5003 10.3731 12.5003 10.8333C12.5003 11.2936 12.1272 11.6667 11.667 11.6667H6.66699C6.20675 11.6667 5.83366 11.2936 5.83366 10.8333Z'

export type FootnoteMarkerIconProps = SvgProps & {
  /** Square edge length in px. */
  size: number
  /** Fill color (the marker is a single `currentColor` path). */
  color: string
}

export function FootnoteMarkerIcon({ size, color, ...props }: FootnoteMarkerIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path fillRule="evenodd" clipRule="evenodd" d={FOOTNOTE_ICON_PATH} fill={color} />
    </Svg>
  )
}

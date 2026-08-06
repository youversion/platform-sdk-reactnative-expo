import { render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'

import {
  YOUVERSION_PLATFORM_LOGO_ASPECT_RATIO,
  YouVersionPlatformLogo,
  youVersionPlatformLogoSize,
} from '../youversion-platform-logo'

/**
 * Stands in for `t('youVersionPlatformLogoAriaLabel')`. The component takes the
 * label as a required prop precisely so no English string can be baked in, so a
 * test string here is the right fixture — asserting real copy would only pin the
 * locale file.
 */
const LABEL = 'test-wordmark-label'

describe('YouVersionPlatformLogo', () => {
  it('renders the caller-supplied accessible label', () => {
    render(<YouVersionPlatformLogo accessibilityLabel={LABEL} />)

    expect(screen.getByLabelText(LABEL)).toBeTruthy()
  })

  it('fills for light by default and switches on the dark theme', () => {
    // react-native-svg normalizes `fill` to opaque ARGB before it reaches the
    // host component, so the assertion is on the packed int, not the hex string.
    expect(renderedPathFill(<YouVersionPlatformLogo accessibilityLabel={LABEL} />)).toBe(0xff121212)
    expect(
      renderedPathFill(<YouVersionPlatformLogo accessibilityLabel={LABEL} theme="light" />),
    ).toBe(0xff121212)
    expect(
      renderedPathFill(<YouVersionPlatformLogo accessibilityLabel={LABEL} theme="dark" />),
    ).toBe(0xffebdbc8)
  })
})

describe('youVersionPlatformLogoSize', () => {
  it('derives height from width so the 11.9:1 wordmark never distorts', () => {
    expect(YOUVERSION_PLATFORM_LOGO_ASPECT_RATIO).toBeCloseTo(11.9)
    expect(youVersionPlatformLogoSize(238)).toEqual({ width: 238, height: 20 })
    expect(youVersionPlatformLogoSize(119)).toEqual({ width: 119, height: 10 })
  })
})

/** The `fill` of the single `<Path>` inside a freshly rendered wordmark. */
function renderedPathFill(element: ReactElement): number | undefined {
  const fills: unknown[] = []
  collectPathFills(render(element).toJSON(), fills)
  expect(fills).toHaveLength(1)
  const fill = fills[0]
  return typeof fill === 'object' && fill !== null && 'payload' in fill
    ? (fill as { payload: number }).payload
    : undefined
}

function collectPathFills(node: unknown, out: unknown[]): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) collectPathFills(child, out)
    return
  }
  const element = node as { props?: Record<string, unknown>; children?: unknown }
  if (element.props && typeof element.props.d === 'string') {
    out.push(element.props.fill)
  }
  collectPathFills(element.children, out)
}
